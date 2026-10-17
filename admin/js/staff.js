let currentAdmin = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentAdmin = await requireAdmin();
  if (!currentAdmin) return;

  if (currentAdmin.role !== 'superadmin') {
    document.getElementById('staff-content').style.display = 'none';
    document.getElementById('not-superadmin-notice').style.display = 'block';
    return;
  }

  loadPending();
  loadAllStaff();

  document.getElementById('add-staff-btn').addEventListener('click', () => {
    document.getElementById('add-staff-form').reset();
    document.getElementById('add-staff-alert').innerHTML = '';
    document.getElementById('add-staff-modal').style.display = 'flex';
  });
  document.getElementById('close-add-staff-modal').addEventListener('click', () => { document.getElementById('add-staff-modal').style.display = 'none'; });
  document.getElementById('add-staff-modal').addEventListener('click', (e) => { if (e.target.id === 'add-staff-modal') document.getElementById('add-staff-modal').style.display = 'none'; });
  document.getElementById('add-staff-form').addEventListener('submit', addStaffDirectly);
});

async function loadPending() {
  const body = document.getElementById('pending-body');
  body.innerHTML = '<tr class="skeleton-row"><td colspan="5"></td></tr>';
  try {
    const { admins } = await adminApi.get('/auth/pending');
    if (!admins.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty-state">No pending requests.</td></tr>';
      return;
    }
    body.innerHTML = admins.map((a) => `
      <tr>
        <td><strong>${a.name}</strong></td>
        <td>${a.email}</td>
        <td style="text-transform:capitalize;">${a.role}</td>
        <td>${formatDateTime(a.createdAt)}</td>
        <td class="table-actions">
          <button class="btn btn-primary btn-sm" data-approve="${a._id}">Approve</button>
          <button class="btn btn-danger btn-sm" data-reject="${a._id}">Reject</button>
        </td>
      </tr>
    `).join('');

    body.querySelectorAll('[data-approve]').forEach((btn) => btn.addEventListener('click', async () => {
      try {
        await adminApi.patch(`/auth/${btn.dataset.approve}/approve`, {});
        showToast('Account approved.', 'success');
        loadPending();
        loadAllStaff();
      } catch (err) { showToast(err.message, 'error'); }
    }));
    body.querySelectorAll('[data-reject]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Reject this access request?')) return;
      try {
        await adminApi.patch(`/auth/${btn.dataset.reject}/reject`, {});
        showToast('Request rejected.', 'success');
        loadPending();
        loadAllStaff();
      } catch (err) { showToast(err.message, 'error'); }
    }));
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" class="empty-state">${err.message}</td></tr>`;
  }
}

async function loadAllStaff() {
  const body = document.getElementById('all-staff-body');
  body.innerHTML = '<tr class="skeleton-row"><td colspan="6"></td></tr>'.repeat(3);
  try {
    const { admins } = await adminApi.get('/auth/all');
    if (!admins.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-state">No staff accounts yet.</td></tr>';
      return;
    }
    body.innerHTML = admins.map((a) => {
      const isSelf = a._id === currentAdmin.id || a._id === currentAdmin._id;
      const statusBadge = a.status === 'approved' ? (a.isActive ? 'active' : 'disabled') : a.status;
      return `
      <tr>
        <td><strong>${a.name}</strong>${isSelf ? ' <span class="form-hint">(you)</span>' : ''}</td>
        <td>${a.email}</td>
        <td>
          ${isSelf || a.status !== 'approved'
            ? `<span style="text-transform:capitalize;">${a.role}</span>`
            : `<select class="role-select" data-role-id="${a._id}" style="border:1px solid var(--stone);border-radius:5px;padding:6px;">
                 ${['staff', 'manager', 'superadmin'].map((r) => `<option value="${r}" ${r === a.role ? 'selected' : ''}>${r}</option>`).join('')}
               </select>`}
        </td>
        <td>${badgeHtml(statusBadge)}</td>
        <td>${formatDateTime(a.lastLoginAt)}</td>
        <td class="table-actions">
          ${!isSelf && a.status === 'approved' ? `<button class="btn btn-outline btn-sm" data-toggle-active="${a._id}" data-current="${a.isActive}">${a.isActive ? 'Suspend' : 'Reactivate'}</button>` : ''}
          ${!isSelf ? `<button class="btn btn-danger btn-sm" data-delete="${a._id}">Delete</button>` : ''}
        </td>
      </tr>
    `;
    }).join('');

    body.querySelectorAll('.role-select').forEach((sel) => sel.addEventListener('change', async () => {
      try {
        await adminApi.patch(`/auth/${sel.dataset.roleId}/role`, { role: sel.value });
        showToast('Role updated.', 'success');
      } catch (err) { showToast(err.message, 'error'); loadAllStaff(); }
    }));
    body.querySelectorAll('[data-toggle-active]').forEach((btn) => btn.addEventListener('click', async () => {
      const isActive = btn.dataset.current === 'true';
      try {
        await adminApi.patch(`/auth/${btn.dataset.toggleActive}/active`, { isActive: !isActive });
        showToast(isActive ? 'Account suspended.' : 'Account reactivated.', 'success');
        loadAllStaff();
      } catch (err) { showToast(err.message, 'error'); }
    }));
    body.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Delete this staff account permanently?')) return;
      try {
        await adminApi.del(`/auth/${btn.dataset.delete}`);
        showToast('Account deleted.', 'success');
        loadAllStaff();
      } catch (err) { showToast(err.message, 'error'); }
    }));
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">${err.message}</td></tr>`;
  }
}

async function addStaffDirectly(e) {
  e.preventDefault();
  const alertEl = document.getElementById('add-staff-alert');
  const payload = {
    name: document.getElementById('as-name').value.trim(),
    email: document.getElementById('as-email').value.trim(),
    role: document.getElementById('as-role').value,
    password: document.getElementById('as-password').value
  };
  try {
    await adminApi.post('/auth/create-admin', payload);
    showToast('Staff account created.', 'success');
    document.getElementById('add-staff-modal').style.display = 'none';
    loadAllStaff();
  } catch (err) {
    alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}
