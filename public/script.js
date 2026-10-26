const filterButtons = [...document.querySelectorAll("[data-filter]")];
const projectCards = [...document.querySelectorAll("[data-category]")];
const modal = document.querySelector("#project-modal");
const modalImage = modal.querySelector("img");
const modalEnglish = modal.querySelector("[data-modal-english]");
const modalTitle = modal.querySelector("[data-modal-title]");

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    projectCards.forEach((card) => {
      card.classList.toggle("is-filtered", filter !== "全部" && card.dataset.category !== filter);
    });
  });
});

document.querySelectorAll("[data-project-image]").forEach((button) => {
  button.addEventListener("click", () => {
    modalImage.src = button.dataset.image;
    modalImage.alt = `${button.dataset.title} 完整项目展示`;
    modalEnglish.textContent = button.dataset.english;
    modalTitle.textContent = button.dataset.title;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  });
});

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}

modal.addEventListener("click", closeModal);
modal.querySelector("button").addEventListener("click", closeModal);
modal.querySelector(".modal-content").addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeModal();
});
