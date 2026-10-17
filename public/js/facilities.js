document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('facilities-grid');
  try {
    const { facilities } = await api.get('/facilities');
    if (!facilities.length) {
      grid.innerHTML = '<p class="empty-state">Facility details are coming soon.</p>';
      return;
    }
    grid.innerHTML = facilities.map((f) => `
      <div class="feature-card" style="padding:0;overflow:hidden;">
        <img src="${f.image.url}" alt="${f.name}" loading="lazy" style="width:100%;height:200px;object-fit:cover;" />
        <div style="padding:24px;">
          <h3>${f.icon ? `${f.icon} ` : ''}${f.name}</h3>
          <p style="margin:0;">${f.description}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
});
