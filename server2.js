const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt'); // For password hashing
const path = require('path');
const PORT = process.env.PORT || 3094;

const app = express();

// Middleware
app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({ extended: true }));
// Set the view engine to EJS
app.set('view engine', 'ejs');

// Session management
app.use(
    session({
        secret: 'your_secret_key',
        resave: false,
        saveUninitialized: false,
    })
);

// MongoDB connection
mongoose
    .connect('mongodb://127.0.0.1:27017/database', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));

// User Schema
const userSchema = new mongoose.Schema({
    fname: { type: String, required: true },
    lname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

// Generate unique account number
function accountNumber() {
    return Math.floor(Math.random() * 100000).toString(); 
}

// Account Schema with account number
const transSchema = new mongoose.Schema({
    type: { type: String, enum: ['Deposit', 'Withdrawal', 'Transfer'], required: true },
    amount: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
    description: { type: String },
    toAccount: { type: String }, // Store target account for transfer
});

const accountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
    accountNumber: { type: String, unique: true, default: accountNumber },
    balance: { type: Number, default: 0 },
    transactions: [transSchema],
});

// Models
const User = mongoose.model('Users', userSchema);
const Account = mongoose.model('Account', accountSchema);

// Directory for HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Home.html'));
});

// Serve Registration Form
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'Register.html'));
});

// Handle Registration
app.post('/post', async (req, res) => {
    const { fname, lname, email, password } = req.body;
    try {
        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send('Email already registered.');
        }

        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
        const newUser = new User({ fname, lname, email, password: hashedPassword });
        await newUser.save();

        // Create an account for the user with a unique account number
        const account = new Account({ userId: newUser._id });
        await account.save();

        res.sendFile(path.join(__dirname, 'msg.html'));
    } catch (err) {
        console.error(err);
        res.status(500).send('Error registering user.');
    }
});

// Serve Login Form
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'Login.html'));
});

// Handle Login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && (await bcrypt.compare(password, user.password))) {
            // Save user session after successful login
            req.session.userId = user._id;

            // Redirect to dashboard or success page
            res.redirect('/dashboard');
        } else {
            // Invalid credentials
            res.status(400).send('Invalid credentials.');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error logging in.');
    }
});

// Serve Dashboard
app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    try {
        const account = await Account.findOne({ userId: req.session.userId }).populate('userId', 'fname lname email');
        res.render('dashboard', {
            name: `${account.userId.fname} ${account.userId.lname}`,
            balance: account.balance,
            accountNumber: account.accountNumber,
            transactions: account.transactions
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading dashboard.');
    }
});

// Handle Deposit
app.post('/deposit', async (req, res) => {
    const { amount, description } = req.body;
    try {
        const account = await Account.findOne({ userId: req.session.userId });
        account.balance += Number(amount);
        account.transactions.push({ type: 'Deposit', amount, description });
        await account.save();
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing deposit.');
    }
});

// Handle Withdrawal
app.post('/withdraw', async (req, res) => {
    const { amount, description } = req.body;
    try {
        const account = await Account.findOne({ userId: req.session.userId });
        if (account.balance < amount) return res.status(400).send('Insufficient funds.');
        account.balance -= Number(amount);
        account.transactions.push({ type: 'Withdrawal', amount, description });
        await account.save();
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing withdrawal.');
    }
});

// Handle Transfer
app.post('/transfer', async (req, res) => {
    const { amount, description, toAccountNumber } = req.body;
    try {
        const fromAccount = await Account.findOne({ userId: req.session.userId });
        const toAccount = await Account.findOne({ accountNumber: toAccountNumber });

        if (!toAccount) {
            return res.status(400).send('Recipient account not found.');
        }

        if (fromAccount.balance < amount) {
            return res.status(400).send('Insufficient funds.');
        }

        // Transfer the amount
        fromAccount.balance -= Number(amount);
        toAccount.balance += Number(amount);

        // Record the transaction
        fromAccount.transactions.push({
            type: 'Transfer',
            amount,
            description,
            toAccount: toAccount.accountNumber,
        });

        toAccount.transactions.push({
            type: 'Transfer',
            amount,
            description,
            toAccount: fromAccount.accountNumber,
        });

        await fromAccount.save();
        await toAccount.save();

        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing transfer.');
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.sendFile(path.join(__dirname, 'Logout.html')));
});

// Start the server

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
