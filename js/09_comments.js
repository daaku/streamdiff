/**
* Comment action and UI.
*/
StreamDiff.Comments = {
  init: function() {
    Delegator.listen('.post-comment textarea', 'focus', function() {
                       StreamDiff.Comments.focus(this);
                     });
    Delegator.listen('.post-comment textarea', 'blur', function() {
                       StreamDiff.Comments.blur(this);
                     });
  },

  show: function(el) {
    var
      post = StreamDiff.Stream.findPost(el),
      form = StreamDiff.DOM.getElementsByClassName(post, 'post-comment')[0];
    form.style.display = 'block';
    form.text.focus();
  },

  submit: function(form) {
    var
      post_id = StreamDiff.Stream.findPostId(form),
      text = form.text.value;

    function response(comment_id) {
      // clear the cache since we do an unintelligent UI update
      Cache.remove(StreamDiff.Stream.cacheKey());

      var post = StreamDiff.Stream._posts[post_id];
      if (post.comments.count) {
        post.comments.count++;
      } else {
        post.comments.count = 1;
      }
      // FIXME the second clause is because by empty comments come in as a
      // empty object and not an empty array
      if (!post.comments.comment_list || !post.comments.comment_list.length) {
        post.comments.comment_list = [];
      }
      post.comments.comment_list.push({
        fromid: Mu.session().uid,
        time: (new Date().getTime() / 1000),
        text: text
      });
      StreamDiff.Stream.refreshPost(post_id);
    }

    Mu.api({
      method  : 'Stream.addComment',
      post_id : post_id,
      comment : text
    }, response);
    return false; // cancel the default form submit
  },

  focus: function(el) {
    StreamDiff.DOM.addClass(el.form, 'focused');
    if (el.value == 'Write a comment…') {
      el.value = '';
    }
  },

  blur: function(el) {
    if (el.value === '') {
      window.setTimeout(
        function() {
          StreamDiff.DOM.removeClass(el.form, 'focused');
          el.value = 'Write a comment…';
        },
        400
      );
    }
  }
};
