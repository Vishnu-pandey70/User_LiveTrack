$(function () {
  const $form = $('#loginForm');
  const $alert = $('#alert');

  function showAlert(type, msg) {
    $alert.html(`<div class="alert alert-${type}" role="alert">${msg}</div>`);
  }

  $form.on('submit', function (e) {
    e.preventDefault();
    $alert.empty();
    $('#loginBtn').prop('disabled', true).text('Logging in...');

    const data = {};
    $(this).serializeArray().forEach(({ name, value }) => (data[name] = value.trim()));

    $.ajax({
      url: '/login',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(data),
      success(res) {
        if (res && res.success && res.user) {
          showAlert('success', res.message || 'Login successful');

          // Save minimal identity for live page
          const auth = {
            email: res.user.email,
            firstName: res.user.firstName,
            lastName: res.user.lastName
          };
          sessionStorage.setItem('authUser', JSON.stringify(auth));

          // Redirect to live page (the socket join happens there)
          window.location.href = '/live_users.html';
        } else {
          showAlert('danger', res.message || 'Login failed');
        }
      },
      error(xhr) {
        let msg = 'Error logging in';
        try {
          const r = xhr.responseJSON;
          msg = (r && (r.message || r.error)) || msg;
        } catch {}
        showAlert('danger', msg);
      },
      complete() {
        $('#loginBtn').prop('disabled', false).text('Login');
      }
    });
  });
});
