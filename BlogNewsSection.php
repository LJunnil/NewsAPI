add_action('wp_footer', function() {
    ?>
    <script>
    document.addEventListener("DOMContentLoaded", function() {
      const blogGrid = document.getElementById("blog-grid");
      const newsGrid = document.getElementById("news-grid");

      if (!blogGrid || !newsGrid) return;

      const url = window.location.href.toLowerCase();

      if (url.includes("blog")) {
        blogGrid.style.display = "block";
        newsGrid.style.display = "none";
      } else if (url.includes("news")) {
        blogGrid.style.display = "none";
        newsGrid.style.display = "block";
      } else {
        blogGrid.style.display = "block";
        newsGrid.style.display = "none";
      }
    });
    </script>
    <?php
});
