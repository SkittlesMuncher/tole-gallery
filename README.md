# Tole Gallery

A small personal gallery for saving photos, GIFs, videos, notes, and web links into named tabs.

## Open it

Open `index.html` in a modern browser, or serve this folder from a local web server. Use the same browser and page address when you return so the browser can reopen the saved collection.

The gallery stores tabs, notes, and photo files in IndexedDB on this device. The saved collection remains available after closing and reopening the page. Browser private mode, clearing site data, or using a different browser or device can make the saved collection unavailable.

## Publish with GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes the site whenever `main` or `master` is updated. Add this folder to a GitHub repository, then in the repository settings choose **Pages → Build and deployment → GitHub Actions**. On GitHub Free, the repository must be public. The published site is public; saved gallery items remain in each visitor's browser and are not included in the deploy.

