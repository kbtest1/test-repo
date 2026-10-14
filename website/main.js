(function () {
  function initials(name) {
    return name.split(/\s+/).map(function (p) { return p[0]; }).join("").slice(0, 2).toUpperCase();
  }

  function card(s) {
    var el = document.createElement("article");
    el.className = "speaker";
    var media = s.photo
      ? '<img src="' + s.photo + '" alt="Photo of ' + s.name + '" loading="lazy">'
      : '<div class="avatar" aria-hidden="true">' + initials(s.name) + "</div>";
    el.innerHTML =
      media +
      "<h3></h3><p class=\"role\"></p><p class=\"bio\"></p>";
    el.querySelector("h3").textContent = s.name;
    el.querySelector(".role").textContent = [s.title, s.company].filter(Boolean).join(", ");
    el.querySelector(".bio").textContent = s.bio || "";
    return el;
  }

  var grid = document.getElementById("speaker-grid");
  (window.SPEAKERS || []).forEach(function (s) { grid.appendChild(card(s)); });
  document.getElementById("year").textContent = new Date().getFullYear();
})();
