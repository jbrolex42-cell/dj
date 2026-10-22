
"use strict";

/* ==================================================
   DJ'S ADULT FAMILY HOME — WEBSITE JAVASCRIPT
================================================== */

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) =>
  Array.from(parent.querySelectorAll(selector));

/* ==================================================
   CONFIGURATION
================================================== */

const PUBLIC_SITE_ENDPOINT = "/api/public/site";
const INQUIRY_ENDPOINT = "/api/inquiries";

const MAX_TEXT_LENGTH = 5000;

/* ==================================================
   GENERAL UTILITIES
================================================== */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function safeDate(value) {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function setText(selector, value) {
  const element = $(selector);

  if (element && value !== undefined && value !== null) {
    element.textContent = String(value);
  }
}

function scrollToSection(selector) {
  const element = $(selector);

  if (!element) return false;

  element.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  return true;
}

function setButtonLoading(button, isLoading, loadingText = "Please wait…") {
  if (!button) return;

  if (isLoading) {
    if (!button.dataset.originalHtml) {
      button.dataset.originalHtml = button.innerHTML;
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    button.removeAttribute("aria-busy");

    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

/* ==================================================
   FOOTER YEAR
================================================== */

const yearElement = $("#year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

/* ==================================================
   MOBILE NAVIGATION
================================================== */

const menuToggle = $("#menuToggle");
const mainNav = $("#mainNav");

function closeNavigation() {
  if (!mainNav || !menuToggle) return;

  mainNav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
}

menuToggle?.addEventListener("click", () => {
  if (!mainNav) return;

  const isOpen = mainNav.classList.toggle("open");

  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute(
    "aria-label",
    isOpen ? "Close navigation" : "Open navigation"
  );
});

mainNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeNavigation);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeNavigation();
  }
});

/* ==================================================
   CARE SEARCH
================================================== */

const careSearchTargets = {
  independent: "independent living",
  "assisted-living": "assisted living",
  nursing: "nursing homes",
  memory: "memory care",
};

function highlightCareGuide(target) {
  const guide = $("#care-guide");

  if (!guide) return;

  const cards = $$(".care-guide-card", guide);

  cards.forEach((card) => {
    card.classList.remove("guide-highlight");
  });

  const match = cards.find((card) =>
    $("h3", card)?.textContent.trim().toLowerCase() === target
  );

  if (!match) return;

  match.classList.add("guide-highlight");

  // Remove the highlight automatically without leaving a stale timer.
  window.setTimeout(() => {
    match.classList.remove("guide-highlight");
  }, 2500);
}

function handleCareSearch() {
  const careValue = $("#careSearch")?.value || "all";
  const locationValue = $("#locationSearch")?.value.trim() || "";

  if (careValue === "room" || careValue === "all" ||
      careValue === "adult-family-home") {
    scrollToSection("#rooms");
  } else if (careSearchTargets[careValue]) {
    scrollToSection("#care-guide");
    highlightCareGuide(careSearchTargets[careValue]);
  } else {
    const careFor = $("#careFor");
    const message = $("#message");

    if (careFor) {
      careFor.value = careValue === "family"
        ? "A parent or family member"
        : "General questions";
    }

    if (message && locationValue) {
      const careDescription = {
        daily: "daily living support",
        companionship: "companionship and connection",
      }[careValue] || "care options";

      message.value =
        `I’m exploring care near ${locationValue}. ` +
        `Please contact me to discuss ${careDescription}.`;
    }

    scrollToSection("#contact");
    message?.focus({ preventScroll: true });
  }

  if (locationValue) {
    const listingLocation = $("#listingLocation")?.textContent.trim() || "";
    const resultNote = $("#searchResultNote");

    if (resultNote) {
      const hasConfirmedLocation =
        listingLocation &&
        !/contact us for location details/i.test(listingLocation);

      resultNote.textContent = hasConfirmedLocation
        ? `You searched near ${locationValue}. Please contact DJ’s Adult Family Home to confirm location suitability and travel arrangements.`
        : `You searched near ${locationValue}. Contact DJ’s Adult Family Home to discuss its location and your travel needs.`;
    }
  }
}

$("#findCareButton")?.addEventListener("click", handleCareSearch);

$("#careSearch")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleCareSearch();
  }
});

$("#locationSearch")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleCareSearch();
  }
});

/* ==================================================
   CARE QUIZ
================================================== */

$("#careQuiz")?.addEventListener("submit", (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);

  const support = data.get("supportLevel");
  const setting = data.get("setting");
  const memory = data.get("memory");

  let title = "Talk with a care professional";

  let body =
    "A conversation about daily needs, preferences, safety, " +
    "and available services can help narrow the options.";

  if (support === "nursing") {
    title = "Explore skilled nursing options";

    body =
      "A licensed healthcare professional or discharge planner can help " +
      "identify the appropriate level of clinical care and facilities to contact.";
  } else if (memory === "yes") {
    title = "Ask providers about memory support";

    body =
      "Ask about dementia-specific training, safety, staffing, daily routines, " +
      "and whether the provider can meet the person’s current needs.";
  } else if (support === "independent" && setting === "community") {
    title = "Explore independent living communities";

    body =
      "Ask about independence, meals, activities, housekeeping, costs, " +
      "and what happens if more support is needed later.";
  } else if (setting === "small" || support === "daily") {
    title = "An adult family home may be worth exploring";

    body =
      "Contact DJ’s Adult Family Home to discuss its actual services and " +
      "whether they may fit your needs. Suitability and availability must " +
      "be confirmed directly. This quiz cannot determine eligibility.";
  }

  const result = $("#quizResult");

  if (!result) return;

  result.replaceChildren();

  const heading = document.createElement("strong");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = body;

  const link = document.createElement("a");
  link.className = "button button-small";
  link.href = "#contact";
  link.textContent = "Discuss options with DJ’s ↗";

  result.append(heading, paragraph, link);
  result.hidden = false;

  result.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
});

/* ==================================================
   PUBLIC WEBSITE CONTENT
================================================== */

function renderServices(services) {
  const grid = $("#serviceGrid");

  if (!grid || !Array.isArray(services) || !services.length) return;

  const icons = {
    heart: "♡",
    utensils: "✳",
    "shield-check": "✓",
    house: "⌂",
    users: "✦",
    "message-circle": "☏",
  };

  grid.innerHTML = services.map((service) => `
    <a class="category-card" href="#contact">
      <span class="category-icon" aria-hidden="true">
        ${icons[service.icon] || "✳"}
      </span>
      <span class="category-arrow" aria-hidden="true">↗</span>
      <h3>${escapeHTML(service.title)}</h3>
      <p>${escapeHTML(service.description)}</p>
      <span class="category-link">
        Ask about this service <b aria-hidden="true">→</b>
      </span>
    </a>
  `).join("");
}

function renderGallery(gallery) {
  const grid = $("#gallery .photo-grid");
  const note = $("#gallery .section-title-row > p");

  if (!grid || !Array.isArray(gallery) || !gallery.length) return;

  const validPhotos = gallery.filter((photo) =>
    typeof photo.imageUrl === "string" && photo.imageUrl.trim()
  );

  if (!validPhotos.length) return;

  grid.innerHTML = validPhotos.map((photo, index) => `
    <figure class="${index === 0 ? "photo-grid-main" : ""}">
      <img
        src="${escapeHTML(photo.imageUrl)}"
        alt="${escapeHTML(photo.title || "DJ’s Adult Family Home")}"
        loading="lazy">
      <figcaption>
        ${escapeHTML(photo.caption || photo.title || "Home gallery")}
      </figcaption>
    </figure>
  `).join("");

  if (note) {
    note.textContent = "Photos shared by DJ’s Adult Family Home.";
  }
}

function renderPosts(posts) {
  const existing = $("#updates");

  // Replace an existing dynamic section instead of adding duplicates.
  existing?.remove();

  if (!Array.isArray(posts) || !posts.length) return;

  const section = document.createElement("section");
  section.className = "updates-section";
  section.id = "updates";

  const cards = posts.map((post) => {
    const article = document.createElement("article");
    article.className = "update-card";

    if (post.imageUrl) {
      const image = document.createElement("img");
      image.src = post.imageUrl;
      image.alt = post.title || "Website update";
      image.loading = "lazy";
      article.appendChild(image);
    }

    const content = document.createElement("div");

    const date = document.createElement("small");
    date.textContent = safeDate(post.createdAt);

    const heading = document.createElement("h3");
    heading.textContent = post.title || "Website update";

    const paragraph = document.createElement("p");
    paragraph.textContent = post.content || "";

    content.append(date, heading, paragraph);
    article.appendChild(content);

    return article;
  });

  const header = document.createElement("div");
  header.className = "section-title-row";

  const titleGroup = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow-pill";
  eyebrow.textContent = "NEWS & NOTICES";

  const heading = document.createElement("h2");
  heading.append("Updates from ");

  const highlight = document.createElement("span");
  highlight.textContent = "our home.";

  heading.appendChild(highlight);
  titleGroup.append(eyebrow, heading);

  const description = document.createElement("p");
  description.textContent =
    "Helpful notices and updates from DJ’s Adult Family Home.";

  header.append(titleGroup, description);

  const grid = document.createElement("div");
  grid.className = "updates-grid";
  grid.append(...cards);

  section.append(header, grid);

  const gallery = $("#gallery");

  if (gallery) {
    gallery.insertAdjacentElement("afterend", section);
  } else {
    $("#rooms")?.insertAdjacentElement("beforebegin", section);
  }
}

function renderRooms(rooms) {
  const root = $("#roomList");

  if (!root || !Array.isArray(rooms) || !rooms.length) return;

  const heading = `
    <div class="room-list-heading">
      <div>
        <span class="eyebrow-pill">ROOM DETAILS</span>
        <h3>Ask about our living spaces</h3>
      </div>
      <p>Availability can change. Please contact us to confirm details.</p>
    </div>
  `;

  const cards = rooms.map((room) => {
    const image = room.imageUrl
      ? `<img src="${escapeHTML(room.imageUrl)}"
           alt="${escapeHTML(room.title || "Living space")}"
           loading="lazy">`
      : '<div class="room-card-placeholder" aria-hidden="true">⌂</div>';

    return `
      <article class="room-card">
        ${image}
        <div class="room-card-body">
          <span class="room-card-type">
            ${escapeHTML(room.roomType || "Living space")}
          </span>
          <h4>${escapeHTML(room.title || "Living space")}</h4>
          <p>
            ${escapeHTML(
              room.description ||
              "Contact us to learn about this living space and whether it may fit your needs."
            )}
          </p>
          <div class="room-card-bottom">
            <span class="room-status">
              ${escapeHTML(room.availability || "Contact us")}
            </span>
            <a href="#contact" class="subtle-link">Ask about room ↗</a>
          </div>
        </div>
      </article>
    `;
  }).join("");

  root.innerHTML = `${heading}<div class="room-cards">${cards}</div>`;
}

function renderBusinessDetails(business) {
  if (!business || typeof business !== "object") return;

  const phone = $("#contactPhone");
  const email = $("#contactEmail");
  const address = $("#contactAddress");
  const listingLocation = $("#listingLocation");

  if (phone && business.phone) {
    phone.textContent = business.phone;

    // Only create a telephone link for a phone number.
    if (phone.tagName === "A") {
      const telephone = business.phone.replace(/[^\d+]/g, "");
      phone.href = `tel:${telephone}`;
    }
  }

  if (email && business.email) {
    email.textContent = business.email;

    if (email.tagName === "A") {
      email.href = `mailto:${business.email}`;
    }
  }

  const businessAddress = business.address || business.location;

  if (businessAddress) {
    if (address) address.textContent = businessAddress;
    if (listingLocation) listingLocation.textContent = businessAddress;
  }
}

async function loadPublicContent() {
  try {
    const response = await fetch(PUBLIC_SITE_ENDPOINT, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("Public website content is unavailable.");
    }

    const data = await response.json();

    if (!data || typeof data !== "object") {
      throw new Error("The server returned invalid website content.");
    }

    renderBusinessDetails(data.business || {});
    renderServices(data.services);
    renderGallery(data.gallery);
    renderPosts(data.posts);
    renderRooms(data.rooms);
  } catch (error) {
    // Static page content remains visible if the API is unavailable.
    console.warn(
      "Using default website content because public content could not be loaded.",
      error
    );
  }
}

loadPublicContent();

/* ==================================================
   CONTACT / INQUIRY FORM
================================================== */

$("#inquiryForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const status = $("#formStatus");
  const button = form.querySelector('button[type="submit"]');
  const consent = $("#consent");

  if (!form.reportValidity()) return;

  if (consent && !consent.checked) {
    if (status) {
      status.textContent = "Please confirm your consent before submitting.";
      status.classList.add("error");
    }

    consent.focus();
    return;
  }

  const formData = Object.fromEntries(new FormData(form).entries());

  // Respect the checkbox value rather than trusting form text alone.
  formData.consent = Boolean(consent?.checked);

  // Avoid unnecessarily large messages from custom or altered forms.
  if (String(formData.message || "").length > MAX_TEXT_LENGTH) {
    if (status) {
      status.textContent = "Your message is too long. Please shorten it and try again.";
      status.classList.add("error");
    }

    return;
  }

  if (status) {
    status.textContent = "";
    status.classList.remove("error");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
  }

  setButtonLoading(button, true, "Sending…");

  try {
    const response = await fetch(INQUIRY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(formData),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error || "We could not send your message. Please try again."
      );
    }

    if (status) {
      status.textContent =
        "Thank you — your inquiry has been received. We’ll be in touch.";
    }

    form.reset();
  } catch (error) {
    if (status) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";

      status.classList.add("error");
    }
  } finally {
    setButtonLoading(button, false);
  }
});
