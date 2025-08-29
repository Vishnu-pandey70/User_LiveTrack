$(function () {
  const socket = io();
  const authRaw = sessionStorage.getItem('authUser');
  const authUser = authRaw ? JSON.parse(authRaw) : null;

  // show auth state
  if (authUser) {
    $('#me').text(`You: ${authUser.firstName || ''} ${authUser.lastName || ''} <${authUser.email || ''}>`);
    $('#authActions').html(`<button id="logoutBtn" class="btn btn-outline-secondary btn-sm">Logout</button>`);
  } else {
    $('#me').text('You are viewing as a guest');
    $('#authActions').html(`
      <a href="/login.html" class="btn btn-primary btn-sm">Login</a>
      <a href="/index.html" class="btn btn-link btn-sm">Register</a>
    `);
  }

  // logout
  $(document).on('click', '#logoutBtn', () => {
    try { socket.emit('leave_live_users'); } catch (e) {}
    sessionStorage.removeItem('authUser');
    window.location.href = '/login.html';
  });

  // join room on connect
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

  // render live users list
  function renderList(list) {
    const $c = $('#users');
    $c.empty();
    if (!list || list.length === 0) {
      $c.append('<div class="list-group-item">No  users connected.</div>');
      return;
    }

    list.forEach(u => {
      if (!u.email) return;
      const $item = $(`
        <button type="button" class="list-group-item list-group-item-action user-item" data-email="${u.email}">
          <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1">${u.email}</h6>
            <small>${u.socketId ? "Online" : "Offline"}</small>

          </div>
          <p class="mb-1">${u.name || ''}</p>
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
                <p><strong>City:</strong> ${u.city || ''}, 
                   <strong>State:</strong> ${u.state || ''}, 
                   <strong>Country:</strong> ${u.country || ''}</p>
                <p><strong>Login ID:</strong> ${u.loginId || ''}</p>
                <p><strong>Created:</strong> ${u.createdAt ? new Date(u.createdAt).toLocaleString() : ''}</p>
                <p><strong>Last Updated:</strong> ${u.updatedAt ? new Date(u.updatedAt).toLocaleString() : ''}</p>
              `;
              $('#modalBody').html(html);
              new bootstrap.Modal(document.getElementById('userModal')).show();
            } else {
              alert('User not found');
            }
          },
          error() {
            alert('Error fetching user');
          }
        });
      });

      $c.append($item);
    });
  }

  // server sends live user updates
  socket.on('live_users_update', (list) => {
    renderList(list);
  });

  // optional: show a console notification when DB user created
  socket.on('user_created_db', (data) => {
    console.log('New DB user created:', data);
  });
});
