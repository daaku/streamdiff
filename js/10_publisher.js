StreamDiff.Publisher = {
  _blurTimer: null,
  _message: null,

  init: function() {
    if (this._initListeners) {
      return;
    }
    this._initListeners = true;

    Delegator.listen('.publisher #message', 'focus', function() {
                       StreamDiff.Publisher.focus(this);
                     });
    Delegator.listen('.publisher #message', 'blur', function() {
                       StreamDiff.Publisher.blur(this);
                     });
    Delegator.listen('.publisher #message', 'keyup', function() {
                       StreamDiff.Publisher.autoSize(this);
                     });
    Delegator.listen('.publisher #message', 'mouseup', function() {
                       StreamDiff.Publisher.autoSize(this);
                     });
  },

  render: function(message) {
    StreamDiff.Publisher.init();
    StreamDiff.Publisher._message = message;
    return (
      '<form class="publisher" onsubmit="return StreamDiff.Publisher.submit()">' +
        '<textarea id="message">' + message + '</textarea>' +
        '<div class="buttons">' +
          '<input type="submit" class="button" value="share">' +
        '</div>' +
      '</form>'
    );
  },

  focus: function(textarea) {
    if (StreamDiff.Publisher._blurTimer) {
      window.clearTimeout(StreamDiff.Publisher._blurTimer);
    }
    if (textarea.value == StreamDiff.Publisher._message) {
      textarea.value = '';
    }
    StreamDiff.DOM.addClass(textarea.form, 'focused');
  },

  blur: function(textarea) {
    if (!textarea.value) {
      StreamDiff.Publisher._blurTimer = window.setTimeout(
        function() {
          StreamDiff.DOM.removeClass(textarea.form, 'focused');
          textarea.value = StreamDiff.Publisher._message;
        }
        ,400
      );
    }
  },

  autoSize: function(textarea) {
  },

  submit: function() {
    var
      target_id = StreamDiff.Stream._options.source_id || undefined,
      message   = document.getElementById('message').value;

    function response(post_id) {
      // clear the cache since we do an unintelligent UI update
      StreamDiff.Storage.remove(StreamDiff.Stream.cacheKey());

      var post = StreamDiff.Stream._posts[post_id] = {
        post_id      : post_id,
        actor_id     : Mu.session().uid,
        target_id    : target_id,
        message      : message,
        created_time : (new Date().getTime() / 1000),
        comments     : {
          can_post : true,
          count    : 0
        },
        likes: {
          can_like : true,
          sample   : [],
          friends  : [],
          count    : 0
        },
        attachment: {
          icon: document.getElementById('favicon').href
        }
      };

      // renderPost returns a html fragment like "<li>...</li>"
      // we create a ul, insert this via innerHTML and move the firstChild to
      // the correct place
      var
        posts = document.getElementById('posts'),
        ul    = document.createElement('ul');

      ul.innerHTML = StreamDiff.Stream.renderPost(
        post,
        StreamDiff.Stream._options
      );

      posts.insertBefore(ul.firstChild, posts.firstChild);
      document.getElementById('message').value = '';
    }

    Mu.api({
      method    : 'Stream.publish',
      target_id : target_id,
      message   : message
    }, response);
    return false; // cancel the default form submit
  }
};
