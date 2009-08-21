StreamDiff.Detail = {
  LIMIT: 20,

  view: function(id, commentsOffset) {
    commentsOffset = commentsOffset || 0;

    var details = (
      'SELECT ' +
        'post_id,' +
        'created_time,' +
        'updated_time,' +
        'actor_id,' +
        'target_id,' +
        'message,' +
        'attachment,' +
        'comments,' +
        'likes ' +
      'FROM ' +
        'stream ' +
      'WHERE ' +
        'post_id="' + id + '"'
    );

    var comments = (
      'SELECT ' +
        'fromid,' +
        'time,' +
        'text ' +
      'FROM ' +
        'comment ' +
      'WHERE ' +
        'post_id="' + id + '"' +
      ' LIMIT ' + StreamDiff.Detail.LIMIT +
      ' OFFSET ' + commentsOffset
    );

    var profiles = (
      'SELECT ' +
        'id,' +
        'type,' +
        'name,' +
        'pic,' +
        'pic_square,' +
        'url ' +
      'FROM ' +
        'profile ' +
      'WHERE ' +
        'id IN (SELECT actor_id FROM #details) OR ' +
        'id IN (SELECT target_id FROM #details) OR ' +
        'id IN (SELECT fromid FROM #comments) OR ' +
        'id IN (SELECT likes.friends FROM #details) OR ' +
        'id IN (SELECT likes.sample FROM #details) OR ' +
        'id=' + Mu.session().uid
    );

    StreamDiff.fql({
      details  : details,
      comments : comments,
      profiles : profiles
    }, StreamDiff.Detail.render);
  },

  render: function(response) {
    // init must happen after we have a confirmed session
    Stream.init();

    // update the cached profiles
    Stream.updateProfiles(response.profiles);

    // we only expect one post back
    //TODO handle not found case
    var details = response.details[0];
    details.comments.comment_list = response.comments;

    StreamDiff.setMainView(
      '<div id="stream" class="bd">' +
        '<ul id="posts">' +
          Stream.renderPost(details, {}) +
        '</ul>' +
      '</div>'
    );
  }
};
