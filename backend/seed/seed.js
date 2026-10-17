/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Admin = require('../models/Admin');
const RoomType = require('../models/RoomType');
const Amenity = require('../models/Amenity');
const Room = require('../models/Room');
const Testimonial = require('../models/Testimonial');
const HotelSettings = require('../models/HotelSettings');
const Gallery = require('../models/Gallery');
const Promotion = require('../models/Promotion');
const Facility = require('../models/Facility');

const PLACEHOLDER_IMAGE = (seed) => `https://picsum.photos/seed/${seed}/1200/800`;

async function seed() {
  await connectDB();
  console.log('Seeding database with demo data...');

  // --- Hotel settings ---
  await HotelSettings.deleteMany({});
  await HotelSettings.create({
    hotelName: 'EK Hotel',
    tagline: 'Where Every Stay Feels Like Royalty',
    description:
      'Nestled in the heart of the city, EK Hotel blends timeless elegance with modern comfort, offering an unforgettable stay for every guest.',
    address: '14 Ahmadu Bello Way, Victoria Island, Lagos, Nigeria',
    phone: '+234 801 234 5678',
    whatsappNumber: '2348012345678',
    email: 'reservations@aureliagrand.com',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    currency: 'NGN',
    currencySymbol: '₦',
    taxPercentage: 7.5,
    bookingPolicy: 'All bookings must be paid in full at the time of reservation to be confirmed.',
    cancellationPolicy: 'Free cancellation up to 48 hours before check-in. Cancellations after this window are non-refundable.',
    socialLinks: {
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
      twitter: 'https://twitter.com',
      tiktok: 'https://tiktok.com'
    },
    mapEmbedUrl: 'https://www.google.com/maps?q=Victoria+Island+Lagos&output=embed',
    latitude: 6.4281,
    longitude: 3.4219
  });

  // --- Admin ---
  await Admin.deleteMany({});
  const adminEmail = process.env.FIRST_ADMIN_EMAIL || 'admin@hotel.com';
  const adminPassword = process.env.FIRST_ADMIN_PASSWORD || 'ChangeMe123!';
  await Admin.create({
    name: process.env.FIRST_ADMIN_NAME || 'Super Admin',
    email: adminEmail,
    password: adminPassword,
    role: 'superadmin',
    status: 'approved',
    isActive: true,
    approvedAt: new Date()
  });
  console.log(`Admin account created -> email: ${adminEmail} | password: ${adminPassword} (change this immediately)`);

  // --- Room types ---
  await RoomType.deleteMany({});
  const roomTypeNames = ['Standard Room', 'Deluxe Room', 'Executive Room', 'Suite', 'Presidential Suite'];
  const roomTypes = await RoomType.insertMany(roomTypeNames.map((name) => ({ name })));
  const typeMap = Object.fromEntries(roomTypes.map((t) => [t.name, t._id]));

  // --- Amenities ---
  await Amenity.deleteMany({});
  const amenityNames = [
    ['Free Wi-Fi', 'wifi', 'both'],
    ['Air Conditioning', 'ac', 'room'],
    ['Flat-screen TV', 'tv', 'room'],
    ['Mini Fridge', 'fridge', 'room'],
    ['Room Service', 'room-service', 'both'],
    ['Private Bathroom', 'bath', 'room'],
    ['Work Desk', 'desk', 'room'],
    ['Breakfast Included', 'breakfast', 'room'],
    ['Swimming Pool', 'pool', 'hotel'],
    ['Gym', 'gym', 'hotel'],
    ['Restaurant', 'restaurant', 'hotel'],
    ['Bar', 'bar', 'hotel'],
    ['Free Parking', 'parking', 'hotel'],
    ['Airport Shuttle', 'shuttle', 'hotel'],
    ['Laundry Service', 'laundry', 'hotel'],
    ['Conference Room', 'conference', 'hotel']
  ];
  const amenities = await Amenity.insertMany(amenityNames.map(([name, icon, scope]) => ({ name, icon, scope })));
  const amenityMap = Object.fromEntries(amenities.map((a) => [a.name, a._id]));

  function pickAmenities(names) {
    return names.map((n) => amenityMap[n]).filter(Boolean);
  }

  // --- Rooms ---
  await Room.deleteMany({});
  const roomsData = [
    {
      name: 'Classic Standard Room',
      roomType: typeMap['Standard Room'],
      description:
        'A cozy and comfortable room designed for the practical traveler, featuring modern furnishings and all essential amenities for a restful stay.',
      shortDescription: 'Comfortable essentials for the practical traveler.',
      pricePerNight: 35000,
      maxGuests: 2,
      bedType: 'Queen Bed',
      sizeSqm: 24,
      totalUnits: 8,
      amenities: pickAmenities(['Free Wi-Fi', 'Air Conditioning', 'Flat-screen TV', 'Private Bathroom']),
      facilities: ['City view', 'Daily housekeeping'],
      isFeatured: false,
      images: [{ url: PLACEHOLDER_IMAGE('standard1') }, { url: PLACEHOLDER_IMAGE('standard2') }]
    },
    {
      name: 'Deluxe Garden Room',
      roomType: typeMap['Deluxe Room'],
      description:
        'Spacious and stylish, the Deluxe Garden Room offers extra comfort with a private balcony overlooking our lush gardens, perfect for relaxation.',
      shortDescription: 'Extra space with a private balcony garden view.',
      pricePerNight: 55000,
      maxGuests: 3,
      bedType: 'King Bed',
      sizeSqm: 32,
      totalUnits: 6,
      amenities: pickAmenities(['Free Wi-Fi', 'Air Conditioning', 'Flat-screen TV', 'Mini Fridge', 'Room Service', 'Work Desk']),
      facilities: ['Garden view', 'Private balcony', 'Daily housekeeping'],
      isFeatured: true,
      images: [{ url: PLACEHOLDER_IMAGE('deluxe1') }, { url: PLACEHOLDER_IMAGE('deluxe2') }, { url: PLACEHOLDER_IMAGE('deluxe3') }]
    },
    {
      name: 'Executive Business Room',
      roomType: typeMap['Executive Room'],
      description:
        'Tailored for the business traveler, this room includes a dedicated workspace, high-speed connectivity, and access to our executive lounge.',
      shortDescription: 'A dedicated workspace for the business traveler.',
      pricePerNight: 75000,
      maxGuests: 2,
      bedType: 'King Bed',
      sizeSqm: 36,
      totalUnits: 5,
      amenities: pickAmenities(['Free Wi-Fi', 'Air Conditioning', 'Flat-screen TV', 'Mini Fridge', 'Room Service', 'Work Desk', 'Breakfast Included']),
      facilities: ['Executive lounge access', 'City skyline view', 'Complimentary breakfast'],
      isFeatured: true,
      images: [{ url: PLACEHOLDER_IMAGE('executive1') }, { url: PLACEHOLDER_IMAGE('executive2') }]
    },
    {
      name: 'Aurelia Suite',
      roomType: typeMap['Suite'],
      description:
        'Indulge in a separate living area, premium furnishings, and panoramic city views. The Aurelia Suite is designed for those who want more.',
      shortDescription: 'A separate living area with panoramic views.',
      pricePerNight: 120000,
      maxGuests: 4,
      bedType: 'King Bed + Sofa Bed',
      sizeSqm: 55,
      totalUnits: 4,
      amenities: pickAmenities(['Free Wi-Fi', 'Air Conditioning', 'Flat-screen TV', 'Mini Fridge', 'Room Service', 'Private Bathroom', 'Breakfast Included']),
      facilities: ['Separate living room', 'Panoramic city view', 'Complimentary breakfast', 'Bathrobe & slippers'],
      isFeatured: true,
      images: [{ url: PLACEHOLDER_IMAGE('suite1') }, { url: PLACEHOLDER_IMAGE('suite2') }, { url: PLACEHOLDER_IMAGE('suite3') }]
    },
    {
      name: 'Presidential Suite',
      roomType: typeMap['Presidential Suite'],
      description:
        'The pinnacle of luxury. Enjoy an expansive layout, private dining area, personal butler service, and unmatched views of the city skyline.',
      shortDescription: 'The pinnacle of luxury with butler service.',
      pricePerNight: 250000,
      maxGuests: 6,
      bedType: '2 King Beds',
      sizeSqm: 110,
      totalUnits: 2,
      amenities: pickAmenities(['Free Wi-Fi', 'Air Conditioning', 'Flat-screen TV', 'Mini Fridge', 'Room Service', 'Private Bathroom', 'Work Desk', 'Breakfast Included']),
      facilities: ['Private dining area', 'Butler service', 'Jacuzzi', 'Panoramic skyline view'],
      isFeatured: true,
      images: [{ url: PLACEHOLDER_IMAGE('presidential1') }, { url: PLACEHOLDER_IMAGE('presidential2') }]
    },
    {
      name: 'Standard Twin Room',
      roomType: typeMap['Standard Room'],
      description: 'Ideal for friends or colleagues traveling together, this room offers two comfortable single beds and all standard amenities.',
      shortDescription: 'Two comfortable single beds for co-travelers.',
      pricePerNight: 38000,
      maxGuests: 2,
      bedType: 'Twin Beds',
      sizeSqm: 24,
      totalUnits: 6,
      amenities: pickAmenities(['Free Wi-Fi', 'Air Conditioning', 'Flat-screen TV', 'Private Bathroom']),
      facilities: ['Courtyard view', 'Daily housekeeping'],
      images: [{ url: PLACEHOLDER_IMAGE('twin1') }, { url: PLACEHOLDER_IMAGE('twin2') }]
    }
  ];

  await Room.insertMany(roomsData);

  // --- Gallery ---
  await Gallery.deleteMany({});
  const galleryCategories = ['rooms', 'exterior', 'restaurant', 'pool', 'events', 'facilities'];
  await Gallery.insertMany(
    galleryCategories.flatMap((category, i) =>
      [1, 2].map((n) => ({ title: `${category} ${n}`, url: PLACEHOLDER_IMAGE(`${category}${n}${i}`), category }))
    )
  );

  // --- Testimonials ---
  await Testimonial.deleteMany({});
  await Testimonial.insertMany([
    {
      guestName: 'Adaeze Okonkwo',
      guestCountry: 'Nigeria',
      rating: 5,
      message: 'Absolutely wonderful stay. The staff were attentive and the Executive Room exceeded every expectation.',
      status: 'approved'
    },
    {
      guestName: 'James Whitfield',
      guestCountry: 'United Kingdom',
      rating: 5,
      message: 'Booking was seamless and the confirmation process gave me total peace of mind. Will definitely return.',
      status: 'approved'
    },
    {
      guestName: 'Fatima Bello',
      guestCountry: 'Nigeria',
      rating: 4,
      message: 'Beautiful hotel with excellent amenities. The pool area was a personal favorite during my stay.',
      status: 'approved'
    }
  ]);

  // --- Promotions ---
  await Promotion.deleteMany({});
  await Promotion.create({
    code: 'WELCOME10',
    description: 'Welcome discount for new guests',
    discountType: 'percentage',
    percentageDiscount: 10,
    startDate: new Date(),
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    usageLimit: 0,
    minimumBookingAmount: 0,
    isActive: true
  });

  // --- Facilities ---
  await Facility.deleteMany({});
  await Facility.insertMany([
    { name: 'Swimming Pool', icon: '🏊', description: 'A heated rooftop pool open year-round, with loungers and skyline views.', displayOrder: 1, image: { url: PLACEHOLDER_IMAGE('facility-pool') } },
    { name: 'Fitness Center', icon: '🏋️', description: 'A fully equipped 24-hour gym with free weights, cardio machines, and a stretching studio.', displayOrder: 2, image: { url: PLACEHOLDER_IMAGE('facility-gym') } },
    { name: 'The Pantry Restaurant', icon: '🍽️', description: 'Our in-house restaurant serving modern West African cuisine for breakfast and dinner.', displayOrder: 3, image: { url: PLACEHOLDER_IMAGE('facility-restaurant') } },
    { name: 'Conference Room', icon: '🧑‍💼', description: 'A private meeting space for up to 20 guests, with projector and video-conferencing setup.', displayOrder: 4, image: { url: PLACEHOLDER_IMAGE('facility-conference') } },
    { name: 'Free Parking', icon: '🚗', description: 'Secure, complimentary on-site parking available to all guests.', displayOrder: 5, image: { url: PLACEHOLDER_IMAGE('facility-parking') } },
    { name: 'Airport Shuttle', icon: '🚐', description: 'Scheduled shuttle service to and from Murtala Muhammed International Airport.', displayOrder: 6, image: { url: PLACEHOLDER_IMAGE('facility-shuttle') } }
  ]);

  console.log('Seed complete.');
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
