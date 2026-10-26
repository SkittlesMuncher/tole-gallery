const DB_NAME = "tole-gallery";
const DB_VERSION = 1;
const COLLECTIONS_STORE = "collections";
const ITEMS_STORE = "items";

const tabsElement = document.querySelector("#tabs");
const galleryElement = document.querySelector("#gallery");
const collectionTitle = document.querySelector("#collection-title");
const itemCount = document.querySelector("#item-count");
const tabDialog = document.querySelector("#tab-dialog");
const wordsDialog = document.querySelector("#words-dialog");
const linkDialog = document.querySelector("#link-dialog");
const photoInput = document.querySelector("#photo-input");
const toastElement = document.querySelector("#toast");

let database;
let collections = [];
let activeCollectionId = null;
let toastTimer;
let activeObjectUrls = [];

function makeId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(COLLECTIONS_STORE)) {
        db.createObjectStore(COLLECTIONS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(ITEMS_STORE)) {
        const items = db.createObjectStore(ITEMS_STORE, { keyPath: "id" });
        items.createIndex("collectionId", "collectionId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeRequest(storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error || new Error("Storage could not be updated."));
  });
}

function getAllItems() {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ITEMS_STORE, "readonly");
    const request = transaction.objectStore(ITEMS_STORE).index("collectionId").getAll(activeCollectionId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove("visible"), 2800);
}

function renderTabs() {
  tabsElement.replaceChildren();
  for (const collection of collections) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab-button";
    button.textContent = collection.name;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(collection.id === activeCollectionId));
    button.addEventListener("click", () => {
      activeCollectionId = collection.id;
      render();
    });
    tabsElement.append(button);
  }
  const activeCollection = collections.find((collection) => collection.id === activeCollectionId);
  collectionTitle.textContent = activeCollection?.name || "Your collection";
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(timestamp));
}

function makeEmptyState() {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.innerHTML = '<div class="empty-state-inner"><div class="empty-mark" aria-hidden="true">✦</div><h3>This tab is ready for you.</h3><p>Add a photo, save a few words, or keep a useful link.</p></div>';
  return empty;
}

function makeCard(item) {
  const card = document.createElement("article");
  card.className = "keep-card";

  if (item.type === "image") {
    const image = document.createElement("img");
    image.alt = item.title || "Saved image";
    image.src = URL.createObjectURL(item.blob);
    activeObjectUrls.push(image.src);
    card.append(image);
  }
  if (item.type === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.preload = "metadata";
    video.playsInline = true;
    video.setAttribute("aria-label", item.title ? `Video: ${item.title}` : "Saved video");
    video.src = URL.createObjectURL(item.blob);
    activeObjectUrls.push(video.src);
    card.append(video);
  }

  const copy = document.createElement("div");
  copy.className = "card-copy";
  if (item.title) {
    const title = document.createElement("h3");
    title.textContent = item.title;
    copy.append(title);
  }
  if (item.type === "text") {
    const body = document.createElement("p");
    body.textContent = item.body;
    copy.append(body);
  }
  if (item.type === "link") {
    const openLink = document.createElement("a");
    openLink.className = "saved-link";
    openLink.href = item.url;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = "Open link ↗";
    copy.append(openLink);

    const address = document.createElement("p");
    address.className = "link-url";
    address.textContent = item.url;
    copy.append(address);
  }
  const date = document.createElement("time");
  date.className = "card-date";
  date.dateTime = new Date(item.createdAt).toISOString();
  date.textContent = formatDate(item.createdAt);
  copy.append(date);
  card.append(copy);

  const footer = document.createElement("div");
  footer.className = "card-footer";
  const removeButton = document.createElement("button");
  removeButton.className = "delete-button";
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.setAttribute("aria-label", `Remove ${item.title || (item.type === "image" ? "photo" : "saved words")}`);
  removeButton.addEventListener("click", async () => {
    try {
      await storeRequest(ITEMS_STORE, "readwrite", (store) => store.delete(item.id));
      showToast("Removed from your collection.");
      await render();
    } catch {
      showToast("It couldn't be removed. Please try again.");
    }
  });
  footer.append(removeButton);
  card.append(footer);
  return card;
}

async function render() {
  renderTabs();
  for (const objectUrl of activeObjectUrls) URL.revokeObjectURL(objectUrl);
  activeObjectUrls = [];
  galleryElement.replaceChildren();
  try {
    const items = await getAllItems();
    items.sort((a, b) => b.createdAt - a.createdAt);
    itemCount.textContent = items.length === 1 ? "1 keepsake" : `${items.length} keepsakes`;
    if (!items.length) {
      galleryElement.append(makeEmptyState());
      return;
    }
    for (const item of items) galleryElement.append(makeCard(item));
  } catch {
    itemCount.textContent = "Your keepsakes";
    galleryElement.append(makeEmptyState());
    showToast("Your collection couldn't be opened. Try refreshing the page.");
  }
}

async function createCollection(name) {
  const collection = { id: makeId(), name: name.trim(), createdAt: Date.now() };
  await storeRequest(COLLECTIONS_STORE, "readwrite", (store) => store.add(collection));
  collections.push(collection);
  activeCollectionId = collection.id;
  await render();
}

async function saveText(title, body) {
  const item = {
    id: makeId(),
    collectionId: activeCollectionId,
    type: "text",
    title: title.trim(),
    body: body.trim(),
    createdAt: Date.now(),
  };
  await storeRequest(ITEMS_STORE, "readwrite", (store) => store.add(item));
}

function normalizeWebAddress(value) {
  const trimmed = value.trim();
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);
  const parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https links are supported.");
  }
  return parsed.href;
}

async function saveLink(title, rawAddress) {
  const url = normalizeWebAddress(rawAddress);
  const parsed = new URL(url);
  const item = {
    id: makeId(),
    collectionId: activeCollectionId,
    type: "link",
    title: title.trim() || parsed.hostname,
    url,
    createdAt: Date.now(),
  };
  await storeRequest(ITEMS_STORE, "readwrite", (store) => store.add(item));
}

async function savePhotos(files) {
  const mediaFiles = [...files].map((file) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const kind = file.type.startsWith("image/") || /^(avif|bmp|gif|jpe?g|png|svg|tiff?|webp)$/.test(extension)
      ? "image"
      : file.type.startsWith("video/") || /^(3gp|avi|m4v|mkv|mov|mp4|ogv|webm)$/.test(extension)
        ? "video"
        : null;
    return kind ? { file, kind } : null;
  }).filter(Boolean);
  if (!mediaFiles.length) {
    showToast("Choose a photo, GIF, or video file.");
    return;
  }
  for (const { file, kind } of mediaFiles) {
    const item = {
      id: makeId(),
      collectionId: activeCollectionId,
      type: kind,
      title: file.name.replace(/\.[^.]+$/, ""),
      blob: file,
      createdAt: Date.now(),
    };
    await storeRequest(ITEMS_STORE, "readwrite", (store) => store.add(item));
  }
  await render();
  const label = mediaFiles.length === 1 ? "file" : "files";
  showToast(`${mediaFiles.length} ${label} saved to this tab.`);
}

document.querySelector("#new-tab-button").addEventListener("click", () => {
  document.querySelector("#tab-form").reset();
  tabDialog.showModal();
  document.querySelector("#tab-name").focus();
});

document.querySelectorAll(".dialog-close").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelector("#tab-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const nameInput = document.querySelector("#tab-name");
  const name = nameInput.value.trim();
  if (!name) return nameInput.focus();
  try {
    await createCollection(name);
    tabDialog.close();
    showToast(`“${name}” is ready.`);
  } catch {
    showToast("The tab couldn't be saved. Please try again.");
  }
});

document.querySelector("#add-words-button").addEventListener("click", () => {
  document.querySelector("#words-form").reset();
  wordsDialog.showModal();
  document.querySelector("#words-body").focus();
});

document.querySelector("#words-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = document.querySelector("#words-title").value;
  const body = document.querySelector("#words-body").value;
  if (!body.trim()) return document.querySelector("#words-body").focus();
  try {
    await saveText(title, body);
    wordsDialog.close();
    await render();
    showToast("Your words are saved.");
  } catch {
    showToast("Your words couldn't be saved. Please try again.");
  }
});

document.querySelector("#add-link-button").addEventListener("click", () => {
  document.querySelector("#link-form").reset();
  linkDialog.showModal();
  document.querySelector("#link-url").focus();
});

document.querySelector("#link-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = document.querySelector("#link-title").value;
  const address = document.querySelector("#link-url").value;
  try {
    await saveLink(title, address);
    linkDialog.close();
    await render();
    showToast("Your link is saved.");
  } catch (error) {
    if (error instanceof TypeError || error.message === "Only http and https links are supported.") {
      showToast("Enter a valid http:// or https:// web address.");
      document.querySelector("#link-url").focus();
      return;
    }
    showToast("The link couldn't be saved. Please try again.");
  }
});

document.querySelector("#upload-button").addEventListener("click", () => photoInput.click());
photoInput.addEventListener("change", async () => {
  try {
    await savePhotos(photoInput.files);
  } catch {
    showToast("The media couldn't be saved. Try smaller files or free up device storage.");
  } finally {
    photoInput.value = "";
  }
});

async function start() {
  try {
    database = await openDatabase();
    collections = await storeRequest(COLLECTIONS_STORE, "readonly", (store) => store.getAll());
    collections.sort((a, b) => a.createdAt - b.createdAt);
    if (!collections.length) {
      await createCollection("My Collection");
      return;
    }
    activeCollectionId = collections[0].id;
    await render();
  } catch {
    document.querySelector(".saved-indicator").innerHTML = '<span class="saved-dot" style="background:#b05262"></span> Storage unavailable';
    galleryElement.append(makeEmptyState());
    showToast("This browser couldn't open local storage. Try opening the page in a standard browser.");
  }
}

start();

