import { withPluginApi } from "discourse/lib/plugin-api";
import Composer from "discourse/models/composer";
import { buildQuote } from "discourse/lib/quote";

function replyToPost(post) {
  const composerController = this.composer;
  const topic = post ? post.get("topic") : this.model;
  const quoteState = this.quoteState;
  const postStream = this.get("model.postStream");

  if (!postStream || !topic || !topic.get("details.can_create_post")) {
    return;
  }

  let quotedText = "";

  if (!quoteState.buffer) {
    if (post) {
      if (
        topic.highest_post_number + 1 - post.post_number >
        settings.quick_quote_post_location_threshold
      ) {
        quotedText = buildQuote(post, post.cooked);

        if (settings.quick_quote_remove_prior_quotes) {
          quotedText = quotedText.replace(/<aside[\s\S]*<\/aside>/g, "");
        }

        if (settings.quick_quote_remove_links) {
          quotedText = quotedText.replace(/<a[\s\S]*<\/a>/g, "");
        }

        const startOfQuoteText = quotedText.indexOf("]") + 2; // not forgetting the new line char
        const lengthOfEndQuoteTag = 11; // [/quote] and newline preceeding
        let startOfExcerpt = startOfQuoteText;
        let excerpt = "";

        if (settings.quick_quote_remove_contiguous_new_lines) {
          excerpt = quotedText.substring(
            startOfExcerpt,
            quotedText.length - lengthOfEndQuoteTag
          );
          excerpt = excerpt.replace(/\n*\n/g, "");

          quotedText =
            quotedText.substring(0, startOfQuoteText) +
            excerpt +
            quotedText.substring(
              quotedText.length - lengthOfEndQuoteTag,
              quotedText.length
            );
        }
        if (settings.quick_quote_character_limit) {
          if (quotedText.length > settings.quick_quote_character_limit) {
            // remove tags because you are splitting text so can't guarantee where
            quotedText = quotedText.replace(/<[^>]*>/g, "");

            startOfExcerpt =
              quotedText.length -
                lengthOfEndQuoteTag -
                settings.quick_quote_character_limit <
              startOfQuoteText
                ? startOfQuoteText
                : quotedText.length -
                  settings.quick_quote_character_limit -
                  lengthOfEndQuoteTag -
                  2;

            quotedText =
              quotedText.substring(0, startOfQuoteText) +
              "..." +
              quotedText.substring(startOfExcerpt, quotedText.length);
          }
        }
      }
    }
  } else {
    const quotedPost = postStream.findLoadedPost(quoteState.postId);
    quotedText = buildQuote(
      quotedPost,
      quoteState.buffer,
      quoteState.opts
    );
  }

  quoteState.clear();

  if (
    composerController.get("model.topic.id") === topic.get("id") &&
    composerController.get("model.action") === Composer.REPLY
  ) {
    composerController.set("model.post", post);
    composerController.set("model.composeState", Composer.OPEN);
    this.appEvents.trigger("composer:insert-block", quotedText.trim());
  } else {
    const opts = {
      action: Composer.REPLY,
      draftKey: topic.get("draft_key"),
      draftSequence: topic.get("draft_sequence")
    };

    if (quotedText) {
      opts.quote = quotedText;
    }

    if (post && post.get("post_number") !== 1) {
      opts.post = post;
    } else {
      opts.topic = topic;
    }

    composerController.open(opts);
  }

  return false;
}

export default {
  name: "quick-quote-edits",

  initialize(container) {
    withPluginApi("0.8.12", api => {
      api.modifyClass("controller:topic", {
        actions: { replyToPost }
      });
    });
  }
};
