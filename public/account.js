"use strict";

// ========================================
// Account login and registration
// ========================================

const form = document.querySelector("#accountForm");
const notice = document.querySelector("#notice");
const submit = document.querySelector("#submitButton");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!notice || !submit) return;

  notice.textContent = "";
  notice.className = "notice";

  const data = Object.fromEntries(new FormData(form).entries());
  const mode = form.dataset.mode;

  // Validate the registration passwords.
  if (mode === "register" && data.password !== data.confirmPassword) {
    notice.textContent = "Your passwords do not match.";
    notice.classList.add("error");
    return;
  }

  if (mode === "register" && data.password.length < 6) {
    notice.textContent = "Use a password with at least  characters.";
    notice.classList.add("error");
    return;
  }

  // Do not send the confirmation field to the server.
  delete data.confirmPassword;

  submit.disabled = true;
  submit.textContent = "Please wait…";

  try {
    const endpoint =
      mode === "register" ? "register" : "login";

    const response = await fetch(`/api/accounts/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to continue. Please try again."
      );
    }

    notice.textContent = result.message || "Success.";
    notice.classList.add("ok");

    window.location.href = "/account.html";
  } catch (error) {
    notice.textContent =
      error.message || "Something went wrong. Please try again.";

    notice.classList.add("error");
  } finally {
    submit.disabled = false;
    submit.textContent =
      mode === "register" ? "Create account" : "Sign in";
  }
});

// ========================================
// Functional show/hide password icons
// ========================================

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);

    if (!input) return;

    const showing = input.type === "password";

    // Show or hide the password.
    input.type = showing ? "text" : "password";

    // Update accessibility information.
    button.setAttribute("aria-pressed", String(showing));

    const label = showing ? "Hide password" : "Show password";

    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);

    // Change the eye icon.
    button.innerHTML = showing
      ? `
        <svg
          class="eye-icon"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 3l18 18"/>
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/>
          <path d="M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 4.1"/>
          <path d="M6.2 6.2C3.5 8 2 12 2 s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/>
        </svg>
      `
      : `
        <svg
          class="eye-icon"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      `;
  });
});

// ========================================
// Automatically display the current year
// ========================================

document.querySelectorAll(".foot #year").forEach((node) => {
  node.textContent = new Date().getFullYear();
});

// ========================================
// Signed-in account page and logout
// ========================================

if (
  document.body.dataset.page === "account" ||
  document.getElementById("logout")
) {
  const welcome = document.getElementById("welcome");
  const details = document.getElementById("details");

  async function loadAccount() {
    try {
      const response = await fetch("/api/accounts/me", {
        credentials: "same-origin"
      });

      if (!response.ok) {
        window.location.href = "/login.html";
        return;
      }

      const result = await response.json();

      if (!result.user) {
        window.location.href = "/login.html";
        return;
      }

      if (welcome) {
        welcome.textContent =
          `Hello, ${result.user.name}. You are signed in.`;
      }

      if (details) {
        details.textContent = result.user.email;
      }
    } catch (_error) {
      window.location.href = "/login.html";
    }
  }

  loadAccount();

  document.getElementById("logout")?.addEventListener(
    "click",
    async () => {
      const logoutButton = document.getElementById("logout");

      if (logoutButton) {
        logoutButton.disabled = true;
      }

      try {
        await fetch("/api/accounts/logout", {
          method: "POST",
          credentials: "same-origin"
        });
      } finally {
        window.location.href = "/";
      }
    }
  );
}