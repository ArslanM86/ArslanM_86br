const state = {
  items: [],
  filter: "all",
  admin: false,
  query: ""
};

const labels = {
  all: "همه",
  movie: "فیلم",
  series: "سریال",
  anime: "انیمه",
  animation: "انیمیشن",
  book: "کتاب"
};

const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const filters = document.getElementById("filters");
const search = document.getElementById("search");
const modal = document.getElementById("modal");
const loginModal = document.getElementById("loginModal");
const addBtn = document.getElementById("addBtn");
const adminBtn = document.getElementById("adminBtn");
const themeBtn = document.getElementById("themeBtn");

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "خطا");
  }

  return data;
}

async function load() {
  state.items = await api("/api/items");

  try {
    const me = await api("/api/me");
    state.admin = Boolean(me.admin ?? me.isAdmin);
  } catch {
    state.admin = false;
  }

  render();
  updateAdminUI();
}

function counts() {
  const c = {
    all: state.items.length,
    movie: 0,
    series: 0,
    anime: 0,
    animation: 0,
    book: 0
  };

  state.items.forEach(item => {
    if (c[item.type] !== undefined) {
      c[item.type]++;
    }
  });

  return c;
}

function renderFilters() {
  const c = counts();

  filters.innerHTML = Object.keys(labels)
    .map(type => `
      <button
        class="filter ${state.filter === type ? "active" : ""}"
        data-filter="${type}"
      >
        ${labels[type]}
        <span class="count">${c[type]}</span>
      </button>
    `)
    .join("");

  filters.querySelectorAll("[data-filter]").forEach(button => {
    button.onclick = () => {
      state.filter = button.dataset.filter;
      render();
    };
  });
}

function render() {
  renderFilters();

  const q = state.query.trim().toLocaleLowerCase("fa");

  const visible = state.items.filter(item => {
    const filterOk =
      state.filter === "all" ||
      item.type === state.filter;

    const text = `${item.title || ""} ${item.genre || ""}`
      .toLocaleLowerCase("fa");

    const searchOk =
      !q || text.includes(q);

    return filterOk && searchOk;
  });

  grid.innerHTML = visible
    .map(item => `
      <article class="card">

        ${
          state.admin
            ? `
              <button
                class="delete"
                title="حذف"
                data-delete="${item.id}"
              >
                ×
              </button>
            `
            : ""
        }

        ${
          item.image
            ? `
              <img
                class="poster"
                src="${escapeHtml(item.image)}"
                alt="${escapeHtml(item.title)}"
                loading="lazy"
              >
            `
            : `
              <div class="no-poster">▧</div>
            `
        }

        <div class="card-body">
          <div class="title">
            ${escapeHtml(item.title)}
          </div>

          ${
            item.genre
              ? `
                <div class="genre">
                  ${escapeHtml(item.genre)}
                </div>
              `
              : ""
          }
        </div>

      </article>
    `)
    .join("");

  empty.classList.toggle(
    "hidden",
    visible.length !== 0
  );

  grid.classList.toggle(
    "hidden",
    visible.length === 0
  );

  grid.querySelectorAll("[data-delete]").forEach(button => {
    button.onclick = async () => {
      if (!confirm("این اثر حذف شود؟")) {
        return;
      }

      try {
        await api(
          `/api/items/${button.dataset.delete}`,
          {
            method: "DELETE"
          }
        );

        await load();

      } catch (err) {
        alert(err.message);
      }
    };
  });
}

function updateAdminUI() {
  adminBtn.textContent = state.admin
    ? "مدیر وارد است"
    : "ورود مدیر";

  addBtn.classList.toggle(
    "hidden",
    !state.admin
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
}

function openModal(target) {
  if (target) {
    target.classList.remove("hidden");
  }
}

function closeModal(target) {
  if (target) {
    target.classList.add("hidden");
  }
}

search.oninput = event => {
  state.query = event.target.value;
  render();
};

adminBtn.onclick = () => {
  if (state.admin) {
    logout();
    return;
  }

  openModal(loginModal);
};

async function logout() {
  try {
    await api("/api/logout", {
      method: "POST"
    });

    state.admin = false;

    render();
    updateAdminUI();

  } catch (err) {
    alert(err.message);
  }
};

addBtn.onclick = () => {
  openModal(modal);
};

document.getElementById("closeModal").onclick = () => {
  closeModal(modal);
};

document.getElementById("closeLogin").onclick = () => {
  closeModal(loginModal);
};

[modal, loginModal].forEach(target => {
  if (!target) return;

  target.addEventListener("click", event => {
    if (event.target === target) {
      closeModal(target);
    }
  });
});

document.getElementById("loginForm").onsubmit = async event => {
  event.preventDefault();

  const msg = document.getElementById("loginMsg");
  const password = document.getElementById("password");

  try {
    await api("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: password.value
      })
    });

    msg.textContent = "";
    password.value = "";

    closeModal(loginModal);

    await load();

  } catch (err) {
    msg.textContent = err.message;
  }
};

document.getElementById("itemForm").onsubmit = async event => {
  event.preventDefault();

  const msg = document.getElementById("formMsg");
  const form = new FormData(event.target);

  try {
    await api("/api/items", {
      method: "POST",
      body: form
    });

    event.target.reset();
    msg.textContent = "";

    closeModal(modal);

    await load();

  } catch (err) {
    msg.textContent = err.message;
  }
};

themeBtn.onclick = () => {
  document.body.classList.toggle("light");

  const light =
    document.body.classList.contains("light");

  themeBtn.textContent = light
    ? "☀"
    : "☾";

  localStorage.setItem(
    "theme",
    light ? "light" : "dark"
  );
};

function loadTheme() {
  const theme = localStorage.getItem("theme");

  if (theme === "light") {
    document.body.classList.add("light");
    themeBtn.textContent = "☀";
  } else {
    themeBtn.textContent = "☾";
  }
}

loadTheme();

load().catch(err => {
  console.error(err);

  empty.classList.remove("hidden");

  const title = empty.querySelector("h2");
  const text = empty.querySelector("p");

  if (title) {
    title.textContent = "سرور اجرا نشده";
  }

  if (text) {
    text.textContent =
      "بعد از راه‌اندازی سرور، آثار اینجا نمایش داده می‌شوند.";
  }
});
