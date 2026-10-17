document.addEventListener('DOMContentLoaded', async () => {
  const admin = await requireAdmin();
  if (!admin) return;

  loadFacilities();

  document.getElementById('add-facility-btn').addEventListener('click', () => openFacilityModal());
  document.getElementById('close-facility-modal').addEventListener('click', () => { document.getElementById('facility-modal').style.display = 'none'; });
  document.getElementById('facility-modal').addEventListener('click', (e) => { if (e.target.id === 'facility-modal') document.getElementById('facility-modal').style.display = 'none'; });
  document.getElementById('facility-form').addEventListener('submit', saveFacility);
});

async function loadFacilities() {
  const body = document.getElementById('facilities-body');
  body.innerHTML = '<tr class="skeleton-row"><td colspan="6"></td></tr>'.repeat(3);
  try {
    const { facilities } = await adminApi.get('/facilities');
    if (!facilities.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-state">No facilities added yet.</td></tr>';
      return;
    }
    body.innerHTML = facilities.map((f) => `
      <tr>
        <td><img src="${f.image.url}" alt="${f.name}" style="width:70px;height:56px;object-fit:cover;border-radius:4px;" /></td>
        <td><strong>${f.icon ? `${f.icon} ` : ''}${f.name}</strong></td>
        <td style="max-width:280px;">${f.description}</td>
        <td>${f.displayOrder}</td>
        <td>${badgeHtml(f.isActive ? 'active' : 'disabled')}</td>
        <td class="table-actions">
          <button class="btn btn-outline btn-sm" data-edit="${f._id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-delete="${f._id}">Delete</button>
        </td>
      </tr>
    `).join('');

    body.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openFacilityModal(facilities.find((f) => f._id === btn.dataset.edit))));
    body.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Delete this facility?')) return;
      try {
        await adminApi.del(`/facilities/${btn.dataset.delete}`);
        showToast('Facility deleted.', 'success');
        loadFacilities();
      } catch (err) { showToast(err.message, 'error'); }
    }));
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">${err.message}</td></tr>`;
  }
}

function openFacilityModal(facility) {
  document.getElementById('facility-form').reset();
  document.getElementById('facility-alert').innerHTML = '';
  document.getElementById('facility-id').value = facility ? facility._id : '';
  document.getElementById('facility-modal-title').textContent = facility ? 'Edit Facility' : 'Add Facility';
  document.getElementById('f-existing-image').innerHTML = facility ? `<img src="${facility.image.url}" alt="" />` : '';
  document.getElementById('f-image').required = !facility;

  if (facility) {
    document.getElementById('f-name').value = facility.name;
    document.getElementById('f-icon').value = facility.icon || '';
    document.getElementById('f-description').value = facility.description;
    document.getElementById('f-order').value = facility.displayOrder;
    document.getElementById('f-active').value = String(facility.isActive);
  }
  document.getElementById('facility-modal').style.display = 'flex';
}

async function saveFacility(e) {
  e.preventDefault();
  const alertEl = document.getElementById('facility-alert');
  const id = document.getElementById('facility-id').value;

  const formData = new FormData();
  formData.append('name', document.getElementById('f-name').value);
  formData.append('icon', document.getElementById('f-icon').value);
  formData.append('description', document.getElementById('f-description').value);
  formData.append('displayOrder', document.getElementById('f-order').value);
  formData.append('isActive', document.getElementById('f-active').value);
  const file = document.getElementById('f-image').files[0];
  if (file) formData.append('image', file);

  try {
    const res = await fetch(`/api/admin/facilities${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST',
      credentials: 'include',
      body: formData
    });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.message || 'Something went wrong.');
    showToast('Facility saved.', 'success');
    document.getElementById('facility-modal').style.display = 'none';
    loadFacilities();
  } catch (err) {
    alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}
