$(function () {
  const socket = io();
  const authRaw = sessionStorage.getItem('authUser');
  const authUser = authRaw ? JSON.parse(authRaw) : null;

  // show who I am (if any)
  // if (authUser) {
  //   $('#me').text(`You: ${authUser.firstName || ''} ${authUser.lastName || ''} <${authUser.email || ''}>`);
  // } else {
  //   $('#me').text('You are viewing as a guest');
  // }



    if (authUser) {
    $('#me').text(`You: ${authUser.firstName || ''} ${authUser.lastName || ''} <${authUser.email || ''}>`);
    $('#authActions').html(`<button id="logoutBtn" class="btn btn-outline-secondary btn-sm">Logout</button>`);
  } else {
    $('#me').text('You are viewing as a guest');
    $('#authActions').html(`
      <a href="/login.html" class="btn btn-primary btn-sm">Login</a>
      <a href="/register.html" class="btn btn-link btn-sm">Register</a>
    `);
  }

    $(document).on('click', '#logoutBtn', () => {
    try { socket.emit('leave_live_users'); } catch(e) {}
    sessionStorage.removeItem('authUser');
    window.location.href = '/login.html';
  });

  // join appropriate room on connect
  socket.on('connect', () => {
    if (authUser && authUser.email) {
      socket.emit('join_live_users', {
        email: authUser.email,
        firstName: authUser.firstName,
        lastName: authUser.lastName
      });
    } else {
      socket.emit('viewer_join');
    }
  });

  // helper to render the live users list
  function renderList(list) {
    const $c = $('#users');
    $c.empty();
    if (!list || list.length === 0) {
      $c.append('<div class="list-group-item">No live users connected.</div>');
      return;
    }

    list.forEach(u => {
      if (!u.email) return;
      const email = u.email || '(no email)';
      const socketId = u.socketId;
      const name = u.name || '';
      const $item = $(`
        <button type="button" class="list-group-item list-group-item-action user-item" data-email="${email}" data-socketid="${socketId}">
          <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1">${email}</h6>
            <small>${socketId}</small>
          </div>
          <p class="mb-1">${name}</p>
        </button>
      `);
      $item.on('click', function () {
        const emailQ = $(this).data('email');
        $.ajax({
          url: '/users',
          data: { email: emailQ },
          success(res) {
            if (res && res.success && res.user) {
              const u = Array.isArray(res.user) ? res.user[0] : res.user;
              const html = `
                <p><strong>Name:</strong> ${u.firstName || ''} ${u.lastName || ''}</p>
                <p><strong>Email:</strong> ${u.email || ''}</p>
                <p><strong>Mobile:</strong> ${u.mobile || ''}</p>
                <p><strong>Address:</strong> ${u.street || ''}</p>
                <p><strong>City:</strong> ${u.city || ''}, <strong>State:</strong> ${u.state || ''}, <strong>Country:</strong> ${u.country || ''}</p>
                <p><strong>Login ID:</strong> ${u.loginId || ''}</p>
                <p><strong>Created:</strong> ${u.createdAt ? new Date(u.createdAt).toLocaleString() : ''}</p>
                <p><strong>Last Updated:</strong> ${u.updatedAt ? new Date(u.updatedAt).toLocaleString() : ''}</p>
              `;
              $('#modalBody').html(html);
              const modal = new bootstrap.Modal(document.getElementById('userModal'));
              modal.show();
            } else {
              alert('User not found');
            }
          },
          error() {
            alert('Error fetching user');
          }
        });
      });
      $('#users').append($item);
    });
  }

  // update list when server sends live_users_update
  socket.on('live_users_update', (list) => {
    renderList(list);
  });

  // optional: when DB user created, you can show a small notification (not added to live list)
  socket.on('user_created_db', (data) => {
    console.log('New DB user created:', data);
  });

  // logout: leave room, clear session, go to login
  $('#logoutBtn').on('click', () => {
    try { socket.emit('leave_live_users'); } catch(e) {}
    sessionStorage.removeItem('authUser');
    window.location.href = '/login.html';
  });
});
