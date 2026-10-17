let currentPage = 1;

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await requireAdmin();
  if (!admin) return;
  loadMessages();
});

async function loadMessages() {
  const body = document.getElementById('messages-body');
  body.innerHTML = '<tr class="skeleton-row"><td colspan="6"></td></tr>'.repeat(4);
  try {
    const { messages, pages } = await adminApi.get(`/messages?page=${currentPage}&limit=15`);
    if (!messages.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-state">No messages yet.</td></tr>';
      return;
    }
    body.innerHTML = messages.map((m) => `
      <tr>
        <td><strong>${m.name}</strong><br/><span style="color:var(--text-muted);font-size:0.8rem;">${m.email}${m.phone ? ` · ${m.phone}` : ''}</span></td>
        <td>${m.subject || '—'}</td>
        <td style="max-width:280px;">${m.message}</td>
        <td>${formatDateTime(m.createdAt)}</td>
        <td>${badgeHtml(m.status)}</td>
        <td class="table-actions">
          ${m.status !== 'read' ? `<button class="btn btn-outline btn-sm" data-status="${m._id}|read">Mark Read</button>` : ''}
          ${m.status !== 'resolved' ? `<button class="btn btn-outline btn-sm" data-status="${m._id}|resolved">Resolve</button>` : ''}
          <button class="btn btn-danger btn-sm" data-delete="${m._id}">Delete</button>
        </td>
      </tr>
    `).join('');

    body.querySelectorAll('[data-status]').forEach((btn) => btn.addEventListener('click', async () => {
      const [id, status] = btn.dataset.status.split('|');
      try { await adminApi.patch(`/messages/${id}/status`, { status }); loadMessages(); } catch (err) { showToast(err.message, 'error'); }
    }));
    body.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Delete this message?')) return;
      try { await adminApi.del(`/messages/${btn.dataset.delete}`); showToast('Deleted.', 'success'); loadMessages(); } catch (err) { showToast(err.message, 'error'); }
    }));

    renderPagination(pages);
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">${err.message}</td></tr>`;
  }
}

function renderPagination(pages) {
  const el = document.getElementById('pagination');
  if (pages <= 1) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <button class="btn btn-outline btn-sm" ${currentPage <= 1 ? 'disabled' : ''} id="prev-page">Previous</button>
    <span style="font-size:0.85rem;color:var(--text-muted);">Page ${currentPage} of ${pages}</span>
    <button class="btn btn-outline btn-sm" ${currentPage >= pages ? 'disabled' : ''} id="next-page">Next</button>
  `;
  document.getElementById('prev-page')?.addEventListener('click', () => { currentPage -= 1; loadMessages(); });
  document.getElementById('next-page')?.addEventListener('click', () => { currentPage += 1; loadMessages(); });
}
