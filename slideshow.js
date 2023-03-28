const images = ['image1.jpg', 'image2.jpg', 'image3.jpg'];
const delay = 3000; // 3 seconds

let index = 0;

function nextImage() {
  index++;
  if (index >= images.length) {
    index = 0;
  }
  const imageUrl = images[index];
  const img = new Image();
  img.src = imageUrl;
  img.onload = function() {
    const slideshow = document.querySelector('.slideshow');
    slideshow.style.backgroundImage = `url(${imageUrl})`;
    setTimeout(nextImage, delay);
  };
}

nextImage();
