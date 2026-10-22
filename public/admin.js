
"use strict";

const byId = (id) => document.getElementById(id);

const loginPanel = byId("loginPanel");
const dashboard = byId("dashboard");

const STATUS_OPTIONS = ["New", "Contacted", "Tour requested", "Closed"];
const ROOM_AVAILABILITY_OPTIONS = [
  "Available",
  "Limited availability",
  "Currently occupied",
  "Contact us",
];

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

let dashboardAdmin = null;
let dashboardLoading = false;

/* --------------------------------------------------
   API HELPERS
-------------------------------------------------- */

async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;

  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  });

  const contentType = response.headers.get("content-type") || "";
  let data = {};

  if (contentType.includes("application/json")) {
    data = await response.json().catch(() => ({}));
  } else {
    const message = await response.text().catch(() => "");
    data = message ? { error: message } : {};
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        data.error || "Your session has expired or you do not have permission."
      );
    }

    throw new Error(data.error || "The request could not be completed.");
  }

  return data;
}

/* --------------------------------------------------
   GENERAL HELPERS
-------------------------------------------------- */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function showStatus(elementId, message, type = "info") {
  const element = byId(elementId);
  if (!element) return;

  element.textContent = message;
  element.dataset.state = type;
}

function setBusy(button, busy, busyText = "Please wait…") {
  if (!button) return;

  if (busy) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent.trim();
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = busyText;
  } else {
    button.disabled = false;
    button.removeAttribute("aria-busy");

    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function showLogin() {
  dashboardAdmin = null;

  loginPanel?.classList.remove("admin-hidden");
  dashboard?.classList.add("admin-hidden");
}

function showDashboard(admin) {
  if (!admin || typeof admin !== "object") {
    showLogin();
    showStatus("loginStatus", "Unable to verify administrator access.", "error");
    return;
  }

  dashboardAdmin = admin;

  loginPanel?.classList.add("admin-hidden");
  dashboard?.classList.remove("admin-hidden");

  const welcome = byId("welcome");

  if (welcome) {
    const name = admin.name || "Administrator";
    const email = admin.email || "";

    welcome.textContent = email
      ? `Signed in as ${name} (${email})`
      : `Signed in as ${name}`;
  }

  refreshDashboard();
}

async function refreshDashboard() {
  if (dashboardLoading || !dashboardAdmin) return;

  dashboardLoading = true;

  try {
    await Promise.allSettled([
      loadInquiries(),
      loadRooms(),
      loadGalleryAdmin(),
      loadPostsAdmin(),
    ]);
  } finally {
    dashboardLoading = false;
  }
}

/* --------------------------------------------------
   INQUIRIES
-------------------------------------------------- */

async function loadInquiries() {
  const tbody = byId("inquiryRows");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="4">Loading inquiries…</td></tr>';

  try {
    const response = await api("/api/admin/inquiries");
    const items = normalizeArray(response);

    if (!items.length) {
      tbody.innerHTML =
        '<tr><td colspan="4">No inquiries have been received yet.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map((item) => {
      const id = escapeHTML(item._id);
      const name = escapeHTML(item.name || "Unnamed contact");
      const email = String(item.email || "");
      const safeEmail = escapeHTML(email);
      const phone = escapeHTML(item.phone || "");
      const careFor = escapeHTML(item.careFor || "Not specified");
      const message = escapeHTML(item.message || "No message provided.");
      const date = escapeHTML(formatDate(item.createdAt));

      const status = STATUS_OPTIONS.includes(item.status)
        ? item.status
        : "New";

      const options = STATUS_OPTIONS.map((option) => `
        <option value="${escapeHTML(option)}"
          ${option === status ? "selected" : ""}>
          ${escapeHTML(option)}
        </option>
      `).join("");

      return `
        <tr>
          <td>${date}</td>
          <td>
            <strong>${name}</strong><br>
            ${email ? `<a href="mailto:${safeEmail}">${safeEmail}</a>` : "No email provided"}
            ${phone ? `<br>${phone}` : ""}
            <br><small>${careFor}</small>
          </td>
          <td class="admin-message">${message}</td>
          <td>
            <select
              data-inquiry-id="${id}"
              data-previous-status="${escapeHTML(status)}"
              aria-label="Inquiry status for ${name}">
              ${options}
            </select>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-inquiry-id]").forEach((select) => {
      select.addEventListener("change", async () => {
        const previousStatus = select.dataset.previousStatus;
        const newStatus = select.value;

        select.disabled = true;

        try {
          await api(
            `/api/admin/inquiries/${encodeURIComponent(select.dataset.inquiryId)}`,
            {
              method: "PATCH",
              body: JSON.stringify({ status: newStatus }),
            }
          );

          select.dataset.previousStatus = newStatus;
        } catch (error) {
          select.value = previousStatus;
          alert(getErrorMessage(error));
        } finally {
          select.disabled = false;
        }
      });
    });
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">${escapeHTML(getErrorMessage(error))}</td>
      </tr>
    `;
  }
}

/* --------------------------------------------------
   LIVING SPACES AND ROOM AVAILABILITY
-------------------------------------------------- */

async function loadRooms() {
  const tbody = byId("roomRows");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="4">Loading living spaces…</td></tr>';

  try {
    const response = await api("/api/admin/rooms");
    const rooms = normalizeArray(response);

    if (!rooms.length) {
      tbody.innerHTML =
        '<tr><td colspan="4">No living spaces have been added yet.</td></tr>';
      return;
    }

    tbody.innerHTML = rooms.map((room) => {
      const id = escapeHTML(room._id);
      const title = escapeHTML(room.title || "Untitled living space");
      const description = escapeHTML(room.description || "");
      const roomType = escapeHTML(room.roomType || "Other");

      const availability = ROOM_AVAILABILITY_OPTIONS.includes(room.availability)
        ? room.availability
        : "Contact us";

      const options = ROOM_AVAILABILITY_OPTIONS.map((option) => `
        <option value="${escapeHTML(option)}"
          ${option === availability ? "selected" : ""}>
          ${escapeHTML(option)}
        </option>
      `).join("");

      return `
        <tr>
          <td>
            <strong>${title}</strong>
            ${description ? `<br><small>${description}</small>` : ""}
          </td>
          <td>${roomType}</td>
          <td>
            <select
              data-room-status="${id}"
              data-previous-status="${escapeHTML(availability)}"
              aria-label="Availability for ${title}">
              ${options}
            </select>
          </td>
          <td>
            <button
              type="button"
              class="admin-button"
              data-delete-room="${id}"
              aria-label="Delete ${title}">
              Delete
            </button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-room-status]").forEach((select) => {
      select.addEventListener("change", async () => {
        const previousStatus = select.dataset.previousStatus;
        const newStatus = select.value;

        select.disabled = true;

        try {
          await api(
            `/api/admin/rooms/${encodeURIComponent(select.dataset.roomStatus)}`,
            {
              method: "PATCH",
              body: JSON.stringify({ availability: newStatus }),
            }
          );

          select.dataset.previousStatus = newStatus;
        } catch (error) {
          select.value = previousStatus;
          alert(getErrorMessage(error));
        } finally {
          select.disabled = false;
        }
      });
    });

    tbody.querySelectorAll("[data-delete-room]").forEach((button) => {
      button.addEventListener("click", async () => {
        const confirmed = confirm(
          "Are you sure you want to delete this living space?"
        );

        if (!confirmed) return;

        setBusy(button, true, "Deleting…");

        try {
          await api(
            `/api/admin/rooms/${encodeURIComponent(button.dataset.deleteRoom)}`,
            { method: "DELETE" }
          );

          await loadRooms();
        } catch (error) {
          alert(getErrorMessage(error));
          setBusy(button, false);
        }
      });
    });
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">${escapeHTML(getErrorMessage(error))}</td>
      </tr>
    `;
  }
}

/* --------------------------------------------------
   ADMIN LOGIN AND LOGOUT
-------------------------------------------------- */

byId("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');

  showStatus("loginStatus", "");
  setBusy(button, true, "Signing in…");

  try {
    const formData = Object.fromEntries(new FormData(form).entries());

    const result = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(formData),
    });

    if (!result.admin) {
      throw new Error("The server did not return an administrator account.");
    }

    form.reset();
    showDashboard(result.admin);
  } catch (error) {
    showStatus("loginStatus", getErrorMessage(error), "error");
  } finally {
    setBusy(button, false);
  }
});

byId("logoutButton")?.addEventListener("click", async () => {
  const button = byId("logoutButton");
  setBusy(button, true, "Signing out…");

  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch (error) {
    // Still hide the dashboard locally. The server must invalidate
    // the session correctly; a failed logout request should be investigated.
    console.error("Administrator logout failed:", error);
  } finally {
    showLogin();
    setBusy(button, false);
  }
});

/* --------------------------------------------------
   ADD A LIVING SPACE
-------------------------------------------------- */

byId("roomForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');

  showStatus("roomStatus", "");
  setBusy(button, true, "Adding living space…");

  try {
    const formData = Object.fromEntries(new FormData(form).entries());

    await api("/api/admin/rooms", {
      method: "POST",
      body: JSON.stringify(formData),
    });

    form.reset();
    showStatus("roomStatus", "Living space added successfully.", "success");

    await loadRooms();
  } catch (error) {
    showStatus("roomStatus", getErrorMessage(error), "error");
  } finally {
    setBusy(button, false);
  }
});

/* --------------------------------------------------
   IMAGE UPLOADS
-------------------------------------------------- */

async function uploadImage(file) {
  if (!(file instanceof File)) {
    throw new Error("Please select a valid image file.");
  }

  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("Please use a JPG, PNG, WEBP, or GIF image.");
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Images must be 5 MB or smaller.");
  }

  const formData = new FormData();
  formData.append("image", file);

  const result = await api("/api/admin/upload", {
    method: "POST",
    body: formData,
  });

  if (!result.imageUrl) {
    throw new Error("The server did not return an image URL.");
  }

  return result.imageUrl;
}

async function uploadIfSelected(inputId) {
  const input = byId(inputId);
  const file = input?.files?.[0];

  return file ? uploadImage(file) : "";
}

/* --------------------------------------------------
   GALLERY AND WEBSITE UPDATES
-------------------------------------------------- */

function contentCard(item, kind) {
  const title = escapeHTML(item.title || "Untitled");
  const caption = escapeHTML(item.caption || item.content || "");
  const id = escapeHTML(item._id);
  const imageUrl = escapeHTML(item.imageUrl || "");

  const image = imageUrl
    ? `<img src="${imageUrl}" alt="${title}" loading="lazy">`
    : "";

  return `
    <article class="admin-content-item">
      ${image}
      <div class="admin-content-item-body">
        <strong>${title}</strong>
        ${caption ? `<p>${caption}</p>` : ""}
        <button
          type="button"
          class="admin-button"
          data-remove-${kind}="${id}">
          Delete
        </button>
      </div>
    </article>
  `;
}

async function loadGalleryAdmin() {
  const root = byId("galleryAdminList");
  if (!root) return;

  root.textContent = "Loading gallery…";

  try {
    const response = await api("/api/admin/gallery");
    const items = normalizeArray(response);

    root.innerHTML = items.length
      ? items.map((item) => contentCard(item, "photo")).join("")
      : "<p>No photos have been published yet.</p>";

    root.querySelectorAll("[data-remove-photo]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this photo from the gallery?")) return;

        setBusy(button, true, "Deleting…");

        try {
          await api(
            `/api/admin/gallery/${encodeURIComponent(button.dataset.removePhoto)}`,
            { method: "DELETE" }
          );

          await loadGalleryAdmin();
        } catch (error) {
          alert(getErrorMessage(error));
          setBusy(button, false);
        }
      });
    });
  } catch (error) {
    root.textContent = getErrorMessage(error);
  }
}

async function loadPostsAdmin() {
  const root = byId("postsAdminList");
  if (!root) return;

  root.textContent = "Loading website updates…";

  try {
    const response = await api("/api/admin/posts");
    const items = normalizeArray(response);

    root.innerHTML = items.length
      ? items.map((item) => contentCard(item, "post")).join("")
      : "<p>No website updates have been published yet.</p>";

    root.querySelectorAll("[data-remove-post]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this website update?")) return;

        setBusy(button, true, "Deleting…");

        try {
          await api(
            `/api/admin/posts/${encodeURIComponent(button.dataset.removePost)}`,
            { method: "DELETE" }
          );

          await loadPostsAdmin();
        } catch (error) {
          alert(getErrorMessage(error));
          setBusy(button, false);
        }
      });
    });
  } catch (error) {
    root.textContent = getErrorMessage(error);
  }
}

/* --------------------------------------------------
   PUBLISH A GALLERY PHOTO
-------------------------------------------------- */

byId("galleryForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');

  showStatus("galleryStatus", "Uploading photo…");
  setBusy(button, true, "Publishing photo…");

  try {
    const imageUrl = await uploadIfSelected("galleryImageFile");

    if (!imageUrl) {
      throw new Error("Please choose a photo to publish.");
    }

    await api("/api/admin/gallery", {
      method: "POST",
      body: JSON.stringify({
        title: byId("galleryTitle").value.trim(),
        caption: byId("galleryCaption").value.trim(),
        imageUrl,
      }),
    });

    form.reset();
    showStatus("galleryStatus", "Photo published successfully.", "success");

    await loadGalleryAdmin();
  } catch (error) {
    showStatus("galleryStatus", getErrorMessage(error), "error");
  } finally {
    setBusy(button, false);
  }
});

/* --------------------------------------------------
   PUBLISH A WEBSITE ANNOUNCEMENT
-------------------------------------------------- */

byId("postForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');

  showStatus("postStatus", "Publishing update…");
  setBusy(button, true, "Publishing update…");

  try {
    const imageUrl = await uploadIfSelected("postImageFile");

    await api("/api/admin/posts", {
      method: "POST",
      body: JSON.stringify({
        title: byId("postTitle").value.trim(),
        content: byId("postContent").value.trim(),
        imageUrl,
      }),
    });

    form.reset();
    showStatus("postStatus", "Website update published successfully.", "success");

    await loadPostsAdmin();
  } catch (error) {
    showStatus("postStatus", getErrorMessage(error), "error");
  } finally {
    setBusy(button, false);
  }
});

/* --------------------------------------------------
   OPTIONAL ROOM PHOTO
-------------------------------------------------- */

byId("roomImageFile")?.addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const file = input.files?.[0];
  const hiddenImage = byId("roomImage");

  if (!file) {
    if (hiddenImage) hiddenImage.value = "";
    showStatus("roomStatus", "");
    return;
  }

  const roomForm = byId("roomForm");
  const submitButton = roomForm?.querySelector('button[type="submit"]');

  if (submitButton) submitButton.disabled = true;

  showStatus("roomStatus", "Uploading room photo…");

  try {
    const imageUrl = await uploadImage(file);

    if (hiddenImage) hiddenImage.value = imageUrl;

    showStatus("roomStatus", "Room photo uploaded and ready.", "success");
  } catch (error) {
    input.value = "";
    if (hiddenImage) hiddenImage.value = "";

    showStatus("roomStatus", getErrorMessage(error), "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

/* --------------------------------------------------
   INITIALIZE ADMIN SESSION
-------------------------------------------------- */

async function initializeAdmin() {
  showLogin();

  try {
    const result = await api("/api/auth/me");

    if (!result.admin) {
      throw new Error("No active administrator session.");
    }

    showDashboard(result.admin);
  } catch {
    // Visitors without a valid session remain on the login screen.
    showLogin();
  }
}

initializeAdmin();