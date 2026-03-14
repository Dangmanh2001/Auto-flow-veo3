module.exports = {
  IngredientsToVideo: async (req, res) => {
    res.render("IngredientsToVideo.ejs");
  },
  IngredientsToVideoPost: async (req, res) => {
    res.redirect("/api/IngredientsToVideo");
  },
};
