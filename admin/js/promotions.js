document.addEventListener('DOMContentLoaded', async () => {
  const admin = await requireAdmin();
  if (!admin) return;

  loadPromotions();

  document.getElementById('add-promo-btn').addEventListener('click', () => openPromoModal());
  document.getElementById('close-promo-modal').addEventListener('click', () => { document.getElementById('promo-modal').style.display = 'none'; });
  document.getElementById('promo-modal').addEventListener('click', (e) => { if (e.target.id === 'promo-modal') document.getElementById('promo-modal').style.display = 'none'; });
  document.getElementById('p-type').addEventListener('change', toggleDiscountFields);
  document.getElementById('promo-form').addEventListener('submit', savePromotion);
});

function toggleDiscountFields() {
  const isPercentage = document.getElementById('p-type').value === 'percentage';
  document.getElementById('p-percentage-group').style.display = isPercentage ? 'flex' : 'none';
  document.getElementById('p-fixed-group').style.display = isPercentage ? 'none' : 'flex';
}

async function loadPromotions() {
  const body = document.getElementById('promotions-body');
  body.innerHTML = '<tr class="skeleton-row"><td colspan="7"></td></tr>'.repeat(3);
  try {
    const { promotions } = await adminApi.get('/promotions');
    if (!promotions.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty-state">No promotions yet.</td></tr>';
      return;
    }
    body.innerHTML = promotions.map((p) => `
      <tr>
        <td><strong>${p.code}</strong></td>
        <td>${p.discountType === 'percentage' ? `${p.percentageDiscount}%` : formatCurrency(p.fixedDiscount)}</td>
        <td>${formatDate(p.startDate)} → ${formatDate(p.endDate)}</td>
        <td>${p.usedCount}${p.usageLimit ? ` / ${p.usageLimit}` : ' (unlimited)'}</td>
        <td>${formatCurrency(p.minimumBookingAmount)}</td>
        <td>${badgeHtml(p.isActive ? 'active' : 'disabled')}</td>
        <td class="table-actions">
          <button class="btn btn-outline btn-sm" data-edit="${p._id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-delete="${p._id}">Delete</button>
        </td>
      </tr>
    `).join('');
    body.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openPromoModal(promotions.find((p) => p._id === btn.dataset.edit))));
    body.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Delete this promotion?')) return;
      try {
        await adminApi.del(`/promotions/${btn.dataset.delete}`);
        showToast('Promotion deleted.', 'success');
        loadPromotions();
      } catch (err) { showToast(err.message, 'error'); }
    }));
  } catch (err) {
    body.innerHTML = `<tr><td colspan="7" class="empty-state">${err.message}</td></tr>`;
  }
}

function openPromoModal(promo) {
  document.getElementById('promo-form').reset();
  document.getElementById('promo-alert').innerHTML = '';
  document.getElementById('promo-id').value = promo ? promo._id : '';
  document.getElementById('promo-modal-title').textContent = promo ? 'Edit Promotion' : 'New Promotion';

  if (promo) {
    document.getElementById('p-code').value = promo.code;
    document.getElementById('p-type').value = promo.discountType;
    document.getElementById('p-percentage').value = promo.percentageDiscount || '';
    document.getElementById('p-fixed').value = promo.fixedDiscount || '';
    document.getElementById('p-min').value = promo.minimumBookingAmount || 0;
    document.getElementById('p-start').value = promo.startDate.slice(0, 10);
    document.getElementById('p-end').value = promo.endDate.slice(0, 10);
    document.getElementById('p-limit').value = promo.usageLimit || 0;
    document.getElementById('p-active').value = String(promo.isActive);
    document.getElementById('p-desc').value = promo.description || '';
  }
  toggleDiscountFields();
  document.getElementById('promo-modal').style.display = 'flex';
}

async function savePromotion(e) {
  e.preventDefault();
  const alertEl = document.getElementById('promo-alert');
  const id = document.getElementById('promo-id').value;
  const payload = {
    code: document.getElementById('p-code').value.trim().toUpperCase(),
    discountType: document.getElementById('p-type').value,
    percentageDiscount: document.getElementById('p-percentage').value ? Number(document.getElementById('p-percentage').value) : undefined,
    fixedDiscount: document.getElementById('p-fixed').value ? Number(document.getElementById('p-fixed').value) : undefined,
    minimumBookingAmount: Number(document.getElementById('p-min').value) || 0,
    startDate: document.getElementById('p-start').value,
    endDate: document.getElementById('p-end').value,
    usageLimit: Number(document.getElementById('p-limit').value) || 0,
    isActive: document.getElementById('p-active').value === 'true',
    description: document.getElementById('p-desc').value.trim()
  };

  try {
    if (id) await adminApi.put(`/promotions/${id}`, payload);
    else await adminApi.post('/promotions', payload);
    showToast('Promotion saved.', 'success');
    document.getElementById('promo-modal').style.display = 'none';
    loadPromotions();
  } catch (err) {
    alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}
