(() => {
  const URL = 'https://pdibtleothnnmihhrbcr.supabase.co';
  const KEY = 'sb_publishable_f74qPRFJj8MQHT1L1Z3GIw_ue3Jx3yK';
  const OWNER_EMAIL = 'bobretor10@gmail.com';
  if (!window.supabase) return;
  const sb = window.supabase.createClient(URL, KEY);

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  let rows = [];

  async function getSession() {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  async function isAdmin() {
    const session = await getSession();
    const user = session?.user;
    if (!user) return false;
    if ((user.email || '').toLowerCase() === OWNER_EMAIL) return true;
    const { data, error } = await sb.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data?.is_admin === true;
  }

  function durationLabel(days) {
    if (days === null || days === undefined || Number(days) >= 9000) return 'Навсегда';
    return `${days} дн.`;
  }

  function render() {
    const body = $('lvKeysBody');
    const count = $('lvKeysCount');
    if (!body) return;
    if (count) count.textContent = rows.length;
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">Ключей пока нет</td></tr>';
      return;
    }
    body.innerHTML = rows.map(k => `
      <tr>
        <td><button class="lv-copy-key" data-key="${esc(k.code)}" title="Копировать">${esc(k.code)}</button></td>
        <td>${esc(durationLabel(k.duration_days))}</td>
        <td><span class="badge-status ${k.is_used ? 'inactive' : 'active'}">${k.is_used ? 'Использован' : 'Свободен'}</span></td>
        <td>${esc(k.used_by || '—')}</td>
        <td style="font-family:monospace;font-size:.78rem">${esc(k.used_by_user_id || '—')}</td>
        <td>${k.used_at ? esc(new Date(k.used_at).toLocaleString('ru-RU')) : '—'}</td>
        <td>${k.created_at ? esc(new Date(k.created_at).toLocaleString('ru-RU')) : '—'}</td>
        <td><button class="lv-delete-key" data-id="${esc(k.id)}" style="padding:7px 10px;border-radius:8px;border:1px solid #6e2c35;background:#231015;color:#ffabb5;cursor:pointer">Удалить</button></td>
      </tr>`).join('');

    body.querySelectorAll('.lv-delete-key').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Удалить этот ключ из базы?')) return;
      const { error } = await sb.from('license_keys').delete().eq('id', btn.dataset.id);
      if (error) { if ($('lvKeyStatus')) $('lvKeyStatus').textContent = 'Ошибка удаления: ' + error.message; return; }
      await loadKeys();
    }));

    body.querySelectorAll('.lv-copy-key').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.key);
        const prev = btn.textContent;
        btn.textContent = 'Скопировано';
        setTimeout(() => btn.textContent = prev, 900);
      } catch (_) {}
    }));
  }

  async function loadKeys() {
    const { data, error } = await sb.from('license_keys')
      .select('id,code,duration_days,is_used,used_by,used_by_user_id,used_at,created_at')
      .like('code', 'LUNAVISUALKEY-%')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw error;
    rows = data || [];
    render();
  }

  async function generate() {
    const btn = $('lvGenerateKeys');
    const status = $('lvKeyStatus');
    const rawCount = parseInt($('lvKeyCount')?.value || '1', 10) || 1;
    const count = Math.max(1, Math.min(100000, rawCount));
    const lifetime = $('lvLifetime')?.checked;
    const days = lifetime ? 999999 : Math.max(1, Math.min(36500, parseInt($('lvDurationDays')?.value || '30', 10) || 30));
    if (btn) { btn.disabled = true; btn.textContent = 'Создание...'; }
    if (status) status.textContent = `Создание ${count} ключей...`;

    try {
      if (!await isAdmin()) throw new Error('Нужен вход под аккаунтом администратора.');
      const all = [];
      const CHUNK = 1000;
      for (let offset = 0; offset < count; offset += CHUNK) {
        const part = Math.min(CHUNK, count - offset);
        const { data, error } = await sb.rpc('generate_lunavisual_keys', {
          p_count: part,
          p_duration_days: days
        });
        if (error) throw error;
        if (Array.isArray(data)) all.push(...data);
        if (status) status.textContent = `Создано ${Math.min(offset + part, count)} из ${count}...`;
      }
      if ($('lvGeneratedOutput')) $('lvGeneratedOutput').value = all.map(x => x.code).join('\n');
      await loadKeys();
      if (status) status.textContent = `Готово: создано ${all.length} ключей. Все сохранены в Supabase.`;
    } catch (e) {
      if (status) status.textContent = `Ошибка генерации: ${e?.message || e}. Выполните обновлённый supabase_setup.sql в SQL Editor.`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Создать ключи'; }
    }
  }

  async function deleteUsedKeys() {
    if (!await isAdmin()) return;
    const usedCount = rows.filter(x => x.is_used).length;
    if (!usedCount) { if ($('lvKeyStatus')) $('lvKeyStatus').textContent = 'Использованных ключей нет.'; return; }
    if (!confirm(`Удалить ${usedCount} использованных ключей из базы?`)) return;
    const { error } = await sb.from('license_keys').delete().eq('is_used', true).like('code', 'LUNAVISUALKEY-%');
    if (error) { if ($('lvKeyStatus')) $('lvKeyStatus').textContent = 'Ошибка удаления: ' + error.message; return; }
    if ($('lvKeyStatus')) $('lvKeyStatus').textContent = `Удалено использованных ключей: ${usedCount}.`;
    await loadKeys();
  }

  async function copyGenerated() {
    const value = $('lvGeneratedOutput')?.value || '';
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      if ($('lvKeyStatus')) $('lvKeyStatus').textContent = 'Список ключей скопирован.';
    } catch (_) {}
  }

  function exportKeys() {
    const csv = ['code,duration_days,is_used,used_by,used_at,created_at', ...rows.map(k => [k.code,k.duration_days ?? 'lifetime',k.is_used,k.used_by ?? '',k.used_at ?? '',k.created_at ?? ''].map(v => `"${String(v).replaceAll('"','""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lunavisual-keys.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const panel = $('lvKeyManager');
    if (!panel) return;
    $('lvGenerateKeys')?.addEventListener('click', generate);
    $('lvRefreshKeys')?.addEventListener('click', () => loadKeys().catch(e => { if ($('lvKeyStatus')) $('lvKeyStatus').textContent = e.message; }));
    $('lvCopyGenerated')?.addEventListener('click', copyGenerated);
    $('lvExportKeys')?.addEventListener('click', exportKeys);
    $('lvDeleteUsedKeys')?.addEventListener('click', () => deleteUsedKeys().catch(e => { if ($('lvKeyStatus')) $('lvKeyStatus').textContent = e.message; }));
    $('lvLifetime')?.addEventListener('change', e => { if ($('lvDurationDays')) $('lvDurationDays').disabled = e.target.checked; });
    try {
      if (!await isAdmin()) { panel.style.display = 'none'; return; }
      panel.style.display = 'block';
      await loadKeys();
    } catch (e) {
      panel.style.display = 'block';
      if ($('lvKeyStatus')) $('lvKeyStatus').textContent = 'Ошибка базы: ' + (e?.message || e) + '. Выполните supabase_setup.sql.';
    }
  });
})();
