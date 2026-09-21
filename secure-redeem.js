(() => {
  // Используем тот же Supabase-клиент, через который пользователь вошёл на сайте.
  // Отдельный createClient здесь приводил к ложной ошибке «Сначала войдите в аккаунт».
  const sb = window.LunaVisualSupabase;
  if (!sb) {
    console.error('LunaVisual: общий Supabase-клиент не инициализирован');
    return;
  }

  async function requireSession() {
    let { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (!data?.session?.user) {
      const refreshed = await sb.auth.refreshSession();
      if (refreshed.error) throw refreshed.error;
      data = refreshed.data;
    }
    if (!data?.session?.user) throw new Error('Сессия истекла. Войдите в аккаунт заново.');
    return data.session;
  }

  function els(form) {
    const modern = form?.id === 'form-redeem-key';
    return {
      input: document.getElementById(modern ? 'input-license-key' : 'inputLicenseKey'),
      button: document.getElementById(modern ? 'btn-redeem-key' : 'btnRedeemKey'),
      alertBox: document.getElementById('profile-alert') || document.getElementById('profileAlert')
    };
  }

  function say(alertBox, msg, type='error') {
    if (typeof window.showAlert === 'function' && alertBox) {
      try { window.showAlert(alertBox, msg, type); return; } catch (_) {}
    }
    if (alertBox) {
      alertBox.textContent = msg;
      alertBox.style.display = 'block';
    } else {
      window.alert(msg);
    }
  }

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!form || !['form-redeem-key', 'formRedeemKey'].includes(form.id)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const { input, button, alertBox } = els(form);
    const code = (input?.value || '').trim().toUpperCase();
    if (!/^LUNAVISUALKEY-(\d{4}-){4}\d{4}$/.test(code)) {
      say(alertBox, 'Введите ключ формата LUNAVISUALKEY-0000-0000-0000-0000-0000.');
      return;
    }
    const oldText = button?.textContent || 'Применить';
    if (button) { button.disabled = true; button.textContent = 'Проверка...'; }

    try {
      const session = await requireSession();

      const { data, error } = await sb.rpc('redeem_lunavisual_key', { p_code: code });
      if (error) throw error;
      if (!data?.ok) {
        if (data?.error === 'used') say(alertBox, 'Этот ключ уже был активирован.');
        else say(alertBox, 'Ключ не найден или введён неверно.');
        return;
      }
      if (input) input.value = '';
      say(alertBox, `✓ Подписка активирована: ${data.subscription_until}`, 'success');
      setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      say(alertBox, e?.message || 'Ошибка активации ключа.');
    } finally {
      if (button) { button.disabled = false; button.textContent = oldText; }
    }
  }, true);


})();
