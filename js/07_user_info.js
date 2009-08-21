StreamDiff.UserInfo = {
  render: function(user) {
    var html;

    if (!Mu.session()) {
      html = '';
    } else if (user) {
      html = (
        '<a class="pic" href="#/profile/' + user.id + '">' +
          '<img src="' + user.pic_square + '">' +
        '</a>' +
        '<a href="#/profile/' + user.id + '">' +
          user.name +
        '</a>' +
        '<br>' +
        '<a class="logout">Logout</a>'
      );
      Cache.put('userInfo', html);
    } else {
      // if there's no user given (and we know there's a Session), we try to
      // load from cache anyways
      html = Cache.get('userInfo');
      if (!html) {
        return;
      }
    }

    document.getElementById('user-info').innerHTML = html;
  }
};
