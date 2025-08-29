$(function () {
  const $form = $('#userForm');
  const $alert = $('#alert');

  function showAlert(type, msg) {
    $alert.html(`<div class="alert alert-${type}" role="alert">${msg}</div>`);
  }

  $form.on('submit', function (e) {
    e.preventDefault();
    $alert.empty();
    $('#saveBtn').prop('disabled', true).text('Saving...');

    const data = {};
    $(this).serializeArray().forEach(({ name, value }) => (data[name] = value.trim()));

    $.ajax({
      url: '/users',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(data),
      success(res) {
        if (res && res.success && res.user) {
          showAlert('success', res.message || 'Saved successfully.');

          // Save minimal identity for live page to join room after redirect
          const auth = {
            email: res.user.email,
            firstName: res.user.firstName,
            lastName: res.user.lastName
          };
          sessionStorage.setItem('authUser', JSON.stringify(auth));

          // Redirect to live page (the socket join happens there)
          window.location.href = '/live_users.html';
        } else {
          showAlert('danger', res.message || res.error || 'Unknown error');
        }
      },
      error(xhr) {
        let msg = 'Error saving';
        try {
          const r = xhr && xhr.responseJSON;
          msg =
            (r && (r.message || r.error || (r.errors && r.errors.join(', ')))) ||
            xhr.statusText ||
            msg;
        } catch (e) {}
        showAlert('danger', msg);
      },
      complete() {
        $('#saveBtn').prop('disabled', false).text('Register');
      }
    });
  });
});
