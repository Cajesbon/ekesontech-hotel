// const multer = require('multer');
// const path = require('path');
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

// const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

// function fileFilter(req, file, cb) {
//   if (!ALLOWED_TYPES.includes(file.mimetype)) {
//     return cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
//   }
//   cb(null, true);
// }

// // Use Cloudinary in production when configured; otherwise fall back to
// // local disk storage under /server/uploads so the app still works for
// // local development without external credentials.
// let storage;
// if (isCloudinaryConfigured()) {
//   storage = new CloudinaryStorage({
//     cloudinary,
//     params: {
//       folder: 'hotel-booking-system',
//       allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
//       transformation: [{ width: 1920, crop: 'limit', quality: 'auto' }]
//     }
//   });
// } else {
//   storage = multer.diskStorage({
//     destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
//     filename: (req, file, cb) => {
//       const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
//       cb(null, `${unique}${path.extname(file.originalname)}`);
//     }
//   });
// }

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 8 * 1024 * 1024, files: 12 }
// });

// // IMPORTANT: multer's file object shape differs by storage backend.
// // - Cloudinary storage sets `file.path` to the final hosted (secure) URL —
// //   safe to use directly as an <img src>.
// // - Local disk storage sets `file.path` to a real filesystem path (e.g.
// //   "/home/user/app/server/uploads/169...-xyz.jpg"), which is NOT a URL the
// //   browser can load. For local storage we must build the URL ourselves
// //   from the public "/uploads" static route instead.
// // Every controller that saves an uploaded image's URL must use this helper
// // rather than reading `file.path` directly, or images silently fail to
// // display whenever Cloudinary isn't configured.
// function fileUrl(file) {
//   return isCloudinaryConfigured() ? file.path : `/uploads/${file.filename}`;
// }

// module.exports = upload;
// module.exports.fileUrl = fileUrl;

const multer = require('multer');
const path = require('path');

// Safely require multer-storage-cloudinary handling both default and named exports
const cloudinaryStorageModule = require('multer-storage-cloudinary');
const CloudinaryStorage = cloudinaryStorageModule.CloudinaryStorage || cloudinaryStorageModule;

const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
  }
  cb(null, true);
}

let storage;
if (isCloudinaryConfigured() && typeof CloudinaryStorage === 'function') {
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'hotel-booking-system',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1920, crop: 'limit', quality: 'auto' }]
    }
  });
} else {
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    }
  });
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024, files: 12 }
});

function fileUrl(file) {
  return isCloudinaryConfigured() ? file.path : `/uploads/${file.filename}`;
}

module.exports = upload;
module.exports.fileUrl = fileUrl;
