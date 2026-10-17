const mongoose = require('mongoose');
const Room = require('../models/Room');
const RoomType = require('../models/RoomType');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { checkRoomAvailability, validateDateRange, getBookedUnits } = require('../services/availabilityService');
const { logAction } = require('../utils/audit');
const upload = require('../middleware/upload');

// ---------- Public ----------

// GET /api/rooms  (supports filtering: type, minPrice, maxPrice, guests, checkIn, checkOut)
exports.getAllRooms = catchAsync(async (req, res) => {
  const { type, minPrice, maxPrice, guests, checkIn, checkOut, page = 1, limit = 12 } = req.query;

  const filter = { status: 'active' };
  if (type) filter.roomType = type;
  if (guests) filter.maxGuests = { $gte: Number(guests) };
  if (minPrice || maxPrice) {
    filter.pricePerNight = {};
    if (minPrice) filter.pricePerNight.$gte = Number(minPrice);
    if (maxPrice) filter.pricePerNight.$lte = Number(maxPrice);
  }

  const skip = (Number(page) - 1) * Number(limit);

  let rooms = await Room.find(filter)
    .populate('roomType', 'name')
    .populate('amenities', 'name icon')
    .sort({ isFeatured: -1, createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Room.countDocuments(filter);

  // If dates were supplied, filter out rooms with zero remaining units.
  if (checkIn && checkOut) {
    const { checkIn: ci, checkOut: co } = validateDateRange(checkIn, checkOut);
    const availabilityChecks = await Promise.all(
      rooms.map(async (room) => {
        const booked = await getBookedUnits(room._id, ci, co);
        return { room, remaining: room.totalUnits - booked };
      })
    );
    rooms = availabilityChecks.filter((r) => r.remaining > 0).map((r) => {
      const obj = r.room.toObject();
      obj.remainingUnits = r.remaining;
      return obj;
    });
  }

  res.status(200).json({
    success: true,
    count: rooms.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    rooms
  });
});

// GET /api/rooms/:id
exports.getRoom = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };

  const room = await Room.findOne(query)
    .populate('roomType', 'name')
    .populate('amenities', 'name icon');

  if (!room) return next(new AppError('Room not found.', 404));
  res.status(200).json({ success: true, room });
});

// GET /api/rooms/availability?roomId=&checkIn=&checkOut=&quantity=
exports.checkAvailability = catchAsync(async (req, res, next) => {
  const { roomId, checkIn, checkOut, quantity = 1 } = req.query;
  if (!roomId || !checkIn || !checkOut) {
    return next(new AppError('roomId, checkIn, and checkOut are required.', 400));
  }
  const { checkIn: ci, checkOut: co, nights } = validateDateRange(checkIn, checkOut);
  const result = await checkRoomAvailability(roomId, ci, co, Number(quantity));

  res.status(200).json({
    success: true,
    available: result.available,
    remainingUnits: result.remaining,
    nights,
    reason: result.reason
  });
});

// GET /api/room-types
exports.getRoomTypes = catchAsync(async (req, res) => {
  const types = await RoomType.find({ isActive: true }).sort('name');
  res.status(200).json({ success: true, roomTypes: types });
});

// ---------- Admin ----------

// GET /api/admin/rooms
exports.adminGetAllRooms = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.name = { $regex: search, $options: 'i' };

  const skip = (Number(page) - 1) * Number(limit);
  const rooms = await Room.find(filter)
    .populate('roomType', 'name')
    .populate('amenities', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));
  const total = await Room.countDocuments(filter);

  res.status(200).json({ success: true, count: rooms.length, total, page: Number(page), pages: Math.ceil(total / limit), rooms });
});

// POST /api/admin/rooms
exports.createRoom = catchAsync(async (req, res, next) => {
  const body = { ...req.body };

  if (req.files && req.files.length) {
    body.images = req.files.map((f) => ({
      url: upload.fileUrl(f),
      publicId: f.filename,
      altText: body.name || ''
    }));
  }

  if (typeof body.amenities === 'string') {
    body.amenities = body.amenities.split(',').map((a) => a.trim()).filter(Boolean);
  }
  if (typeof body.facilities === 'string') {
    body.facilities = body.facilities.split(',').map((a) => a.trim()).filter(Boolean);
  }

  const room = await Room.create(body);
  await logAction(req, { action: 'room_created', targetModel: 'Room', targetId: room._id, details: { name: room.name } });

  res.status(201).json({ success: true, room });
});

// PUT /api/admin/rooms/:id
exports.updateRoom = catchAsync(async (req, res, next) => {
  const body = { ...req.body };

  if (req.files && req.files.length) {
    const newImages = req.files.map((f) => ({
      url: upload.fileUrl(f),
      publicId: f.filename,
      altText: body.name || ''
    }));
    const existing = await Room.findById(req.params.id);
    if (!existing) return next(new AppError('Room not found.', 404));
    body.images = [...(existing.images || []), ...newImages];
  }

  if (typeof body.amenities === 'string') {
    body.amenities = body.amenities.split(',').map((a) => a.trim()).filter(Boolean);
  }
  if (typeof body.facilities === 'string') {
    body.facilities = body.facilities.split(',').map((a) => a.trim()).filter(Boolean);
  }

  const room = await Room.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!room) return next(new AppError('Room not found.', 404));

  await logAction(req, { action: 'room_updated', targetModel: 'Room', targetId: room._id });
  res.status(200).json({ success: true, room });
});

// DELETE /api/admin/rooms/:id
exports.deleteRoom = catchAsync(async (req, res, next) => {
  const room = await Room.findByIdAndDelete(req.params.id);
  if (!room) return next(new AppError('Room not found.', 404));
  await logAction(req, { action: 'room_deleted', targetModel: 'Room', targetId: room._id, details: { name: room.name } });
  res.status(200).json({ success: true, message: 'Room deleted successfully.' });
});

// PATCH /api/admin/rooms/:id/status  { status: 'active' | 'disabled' | 'maintenance' }
exports.setRoomStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  if (!['active', 'disabled', 'maintenance'].includes(status)) {
    return next(new AppError('Invalid room status.', 400));
  }
  const room = await Room.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!room) return next(new AppError('Room not found.', 404));
  await logAction(req, { action: 'room_status_changed', targetModel: 'Room', targetId: room._id, details: { status } });
  res.status(200).json({ success: true, room });
});

// ---------- Room Types (admin) ----------

exports.createRoomType = catchAsync(async (req, res) => {
  const type = await RoomType.create(req.body);
  await logAction(req, { action: 'room_type_created', targetModel: 'RoomType', targetId: type._id });
  res.status(201).json({ success: true, roomType: type });
});

exports.updateRoomType = catchAsync(async (req, res, next) => {
  const type = await RoomType.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!type) return next(new AppError('Room type not found.', 404));
  res.status(200).json({ success: true, roomType: type });
});

exports.deleteRoomType = catchAsync(async (req, res, next) => {
  const inUse = await Room.exists({ roomType: req.params.id });
  if (inUse) return next(new AppError('Cannot delete a room type that is still assigned to rooms.', 400));
  const type = await RoomType.findByIdAndDelete(req.params.id);
  if (!type) return next(new AppError('Room type not found.', 404));
  res.status(200).json({ success: true, message: 'Room type deleted.' });
});
