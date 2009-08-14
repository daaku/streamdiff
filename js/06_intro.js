/**
 * Intro View - handles login and permissioning.
 */
StreamDiff.Intro = {
  view: function() {
    if (Mu.session()) {
      StreamDiff.fql({
        user: (
          'SELECT ' +
            'name,' +
            'pic_square,' +
            'profile_url ' +
          'FROM ' +
            'user ' +
          'WHERE ' +
            'uid=' + Mu.session().uid
        ),
        perms: (
          'SELECT ' +
            'read_stream,' +
            'publish_stream ' +
          'FROM ' +
            'permissions ' +
          'WHERE ' +
            'uid=' + Mu.session().uid
        )
      }, StreamDiff.Intro.render);
    } else {
      StreamDiff.Intro.render();
    }
  },

  render: function(results) {
    if (results) {
      var user = results.user[0];
      StreamDiff.UserInfo.render(user);

      // check if necessary permissions have already been granted
      if (results.perms[0].publish_stream && results.perms[0].read_stream) {
        StreamDiff.Stream.view();
        return;
      }
    }

    StreamDiff.setMainView(
      '<div id="intro" class="bd">' +
        '<div class="what">' +
          '<p>' +
          'StreamDiff provides an alternate view of your Facebook News ' +
          'Feed. It provides a <strong>Mark as read</strong> feature to ' +
          'allow focusing on just the new stuff. Comments and Like\'s ' +
          'will make a post fresh again, so you\'ll get all new content as ' +
          ' soon as its created!' +
          '</p>' +
          '<p>' +
          'In order to use StreamDiff, you must sign in with your Facebook ' +
          'account and allow access to your stream.' +
          '</p>' +
        '</div>' +

        '<div class="buttons">' +
          '<button class="connect" onclick="StreamDiff.Intro.connect()">'+
            'Connect with Facebook' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  },

  /**
   * Handles the connect action.
   */
  connect: function() {
    Mu.login(function(session) {
      StreamDiff.Stream.view();
    }, 'read_stream,publish_stream');
  }
};
