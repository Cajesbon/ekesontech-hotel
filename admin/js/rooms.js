let roomTypesCache = [];
let amenitiesCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await requireAdmin();
  if (!admin) return;

  await Promise.all([loadRoomTypesForForm(), loadAmenitiesForForm()]);
  loadRooms();

  document.getElementById('add-room-btn').addEventListener('click', () => openRoomModal());
  document.getElementById('close-room-modal').addEventListener('click', () => { document.getElementById('room-modal').style.display = 'none'; });
  document.getElementById('room-modal').addEventListener('click', (e) => { if (e.target.id === 'room-modal') document.getElementById('room-modal').style.display = 'none'; });
  document.getElementById('room-form').addEventListener('submit', saveRoom);

  document.getElementById('manage-types-btn').addEventListener('click', () => { document.getElementById('types-modal').style.display = 'flex'; renderTypesList(); });
  document.getElementById('close-types-modal').addEventListener('click', () => { document.getElementById('types-modal').style.display = 'none'; });
  document.getElementById('types-modal').addEventListener('click', (e) => { if (e.target.id === 'types-modal') document.getElementById('types-modal').style.display = 'none'; });
  document.getElementById('type-form').addEventListener('submit', addRoomType);
});

async function loadRoomTypesForForm() {
  try {
    const res = await fetch('/api/rooms/types/all');
    const data = await res.json();
    roomTypesCache = data.roomTypes || [];
    const select = document.getElementById('r-type');
    select.innerHTML = roomTypesCache.map((t) => `<option value="${t._id}">${t.name}</option>`).join('');
  } catch (err) {
    showToast('Could not load room types.', 'error');
  }
}

async function loadAmenitiesForForm() {
  try {
    const res = await fetch('/api/amenities');
    const data = await res.json();
    amenitiesCache = data.amenities || [];
    document.getElementById('r-amenities-list').innerHTML = amenitiesCache.map((a) => `
      <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;border:1px solid var(--stone);padding:6px 10px;border-radius:20px;">
        <input type="checkbox" value="${a._id}" class="amenity-checkbox" /> ${a.name}
      </label>
    `).join('');
  } catch (err) { /* non-critical */ }
}

async function loadRooms() {
  const body = document.getElementById('rooms-body');
  body.innerHTML = '<tr class="skeleton-row"><td colspan="7"></td></tr>'.repeat(4);
  try {
    const { rooms } = await adminApi.get('/rooms?limit=100');
    if (!rooms.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty-state">No rooms yet. Add your first room to get started.</td></tr>';
      return;
    }
    body.innerHTML = rooms.map((r) => `
      <tr>
        <td><strong>${r.name}</strong></td>
        <td>${r.roomType?.name || '—'}</td>
        <td>${formatCurrency(r.pricePerNight)}</td>
        <td>${r.maxGuests}</td>
        <td>${r.totalUnits}</td>
        <td>${badgeHtml(r.status)}</td>
        <td class="table-actions">
          <button class="btn btn-outline btn-sm" data-edit="${r._id}">Edit</button>
          <select class="btn btn-outline btn-sm" data-status="${r._id}" style="border:1px solid var(--stone);">
            <option value="active" ${r.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="disabled" ${r.status === 'disabled' ? 'selected' : ''}>Disabled</option>
            <option value="maintenance" ${r.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
          </select>
          <button class="btn btn-danger btn-sm" data-delete="${r._id}">Delete</button>
        </td>
      </tr>
    `).join('');

    body.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openRoomModal(btn.dataset.edit)));
    body.querySelectorAll('[data-status]').forEach((sel) => sel.addEventListener('change', async () => {
      try {
        await adminApi.patch(`/rooms/${sel.dataset.status}/status`, { status: sel.value });
        showToast('Room status updated.', 'success');
        loadRooms();
      } catch (err) { showToast(err.message, 'error'); }
    }));
    body.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Delete this room? This cannot be undone.')) return;
      try {
        await adminApi.del(`/rooms/${btn.dataset.delete}`);
        showToast('Room deleted.', 'success');
        loadRooms();
      } catch (err) { showToast(err.message, 'error'); }
    }));
  } catch (err) {
    body.innerHTML = `<tr><td colspan="7" class="empty-state">${err.message}</td></tr>`;
  }
}

async function openRoomModal(roomId) {
  document.getElementById('room-form').reset();
  document.getElementById('room-id').value = '';
  document.getElementById('existing-images').innerHTML = '';
  document.querySelectorAll('.amenity-checkbox').forEach((cb) => { cb.checked = false; });
  document.getElementById('room-modal-alert').innerHTML = '';
  document.getElementById('room-modal-title').textContent = roomId ? 'Edit Room' : 'Add Room';
  document.getElementById('room-modal').style.display = 'flex';

  if (roomId) {
    try {
      const { room } = await adminApi.get(`/rooms/${roomId}`);
      document.getElementById('room-id').value = room._id;
      document.getElementById('r-name').value = room.name;
      document.getElementById('r-type').value = room.roomType?._id || room.roomType;
      document.getElementById('r-short').value = room.shortDescription || '';
      document.getElementById('r-desc').value = room.description;
      document.getElementById('r-price').value = room.pricePerNight;
      document.getElementById('r-guests').value = room.maxGuests;
      document.getElementById('r-bed').value = room.bedType;
      document.getElementById('r-size').value = room.sizeSqm || '';
      document.getElementById('r-units').value = room.totalUnits;
      document.getElementById('r-featured').value = String(room.isFeatured);
      document.getElementById('r-facilities').value = (room.facilities || []).join(', ');
      (room.amenities || []).forEach((a) => {
        const cb = document.querySelector(`.amenity-checkbox[value="${a._id || a}"]`);
        if (cb) cb.checked = true;
      });
      document.getElementById('existing-images').innerHTML = (room.images || []).map((img) => `<img src="${img.url}" alt="" />`).join('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

async function saveRoom(e) {
  e.preventDefault();
  const alertEl = document.getElementById('room-modal-alert');
  alertEl.innerHTML = '';
  const roomId = document.getElementById('room-id').value;

  const formData = new FormData();
  formData.append('name', document.getElementById('r-name').value);
  formData.append('roomType', document.getElementById('r-type').value);
  formData.append('shortDescription', document.getElementById('r-short').value);
  formData.append('description', document.getElementById('r-desc').value);
  formData.append('pricePerNight', document.getElementById('r-price').value);
  formData.append('maxGuests', document.getElementById('r-guests').value);
  formData.append('bedType', document.getElementById('r-bed').value);
  if (document.getElementById('r-size').value) formData.append('sizeSqm', document.getElementById('r-size').value);
  formData.append('totalUnits', document.getElementById('r-units').value);
  formData.append('isFeatured', document.getElementById('r-featured').value);
  formData.append('facilities', document.getElementById('r-facilities').value);

  const selectedAmenities = Array.from(document.querySelectorAll('.amenity-checkbox:checked')).map((cb) => cb.value);
  formData.append('amenities', selectedAmenities.join(','));

  const files = document.getElementById('r-images').files;
  Array.from(files).forEach((f) => formData.append('images', f));

  try {
    if (roomId) {
      await fetchFormData(`/rooms/${roomId}`, 'PUT', formData);
    } else {
      await fetchFormData('/rooms', 'POST', formData);
    }
    showToast('Room saved successfully.', 'success');
    document.getElementById('room-modal').style.display = 'none';
    loadRooms();
  } catch (err) {
    alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function fetchFormData(path, method, formData) {
  const res = await fetch(`/api/admin${path}`, { method, credentials: 'include', body: formData });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || 'Something went wrong.');
  return data;
}

function renderTypesList() {
  const el = document.getElementById('types-list');
  if (!roomTypesCache.length) { el.innerHTML = '<p class="empty-state">No room types yet.</p>'; return; }
  el.innerHTML = roomTypesCache.map((t) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--stone);">
      <span>${t.name}</span>
      <button class="btn btn-danger btn-sm" data-delete-type="${t._id}">Delete</button>
    </div>
  `).join('');
  el.querySelectorAll('[data-delete-type]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Delete this room type?')) return;
    try {
      await adminApi.del(`/rooms/types/${btn.dataset.deleteType}`);
      showToast('Room type deleted.', 'success');
      await loadRoomTypesForForm();
      renderTypesList();
    } catch (err) {
      document.getElementById('types-alert').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  }));
}

async function addRoomType(e) {
  e.preventDefault();
  const input = document.getElementById('new-type-name');
  try {
    await adminApi.post('/rooms/types', { name: input.value.trim() });
    input.value = '';
    showToast('Room type added.', 'success');
    await loadRoomTypesForForm();
    renderTypesList();
  } catch (err) {
    document.getElementById('types-alert').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}
