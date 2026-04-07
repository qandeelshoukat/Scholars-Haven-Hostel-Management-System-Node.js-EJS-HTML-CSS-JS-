function toggleMenu() {
    const menu = document.getElementById("navMenu");
    menu.classList.toggle("responsive");
}

function toggleForm(formType) {
    const loginForm = document.getElementById("login");
    const registerForm = document.getElementById("register");

    if (formType === 'login') {
        loginForm.classList.remove("hidden");
        registerForm.classList.add("hidden");
    } else {
        loginForm.classList.add("hidden");
        registerForm.classList.remove("hidden");
    }
}
