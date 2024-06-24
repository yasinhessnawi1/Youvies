
 document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('particle-background-canvas');
    const ctx = canvas.getContext('2d');
    let mouse = { x: null, y: null, radius: 150 };
    let particleText = [];

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        drawText();
    });

    canvas.addEventListener('mousemove', (event) => {
        mouse.x = event.x;
        mouse.y = event.y;
    });

    class Particle {
        constructor(x, y, size, color, weight) {
            this.x = x;
            this.y = y;
            this.size = size;
            this.color = color;
            this.weight = weight;
            this.baseX = this.x;
            this.baseY = this.y;
            this.density = Math.random() * 1000000 + 1;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.fill();
        }

        update() {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            let forceDirectionX = dx / distance;
            let forceDirectionY = dy / distance;
            let maxDistance = mouse.radius;
            let force = (maxDistance - distance) / maxDistance;
            let directionX = forceDirectionX * force * this.density;
            let directionY = forceDirectionY * force * this.density;

            if (distance < mouse.radius) {
                this.x -= directionX;
                this.y -= directionY;
            } else {
                if (this.x !== this.baseX) {
                    let dx = this.x - this.baseX;
                    this.x -= dx / 50;
                }
                if (this.y !== this.baseY) {
                    let dy = this.y - this.baseY;
                    this.y -= dy / 50;
                }
            }
        }
    }


     function drawText() {
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         ctx.fillStyle = 'white';
         const fontSize = Math.min(canvas.width / 20, canvas.height / 20);
         ctx.font = `bold ${fontSize}px Arial`;
         const text = 'Youvies';
         const textMetrics = ctx.measureText(text);
         const textX = (canvas.width - textMetrics.width) / 3;
         const textY = (canvas.height + fontSize / 2) /4;
         ctx.fillText(text, textX, textY);
         ctx.willReadFrequently = true;
         const textCoordinates = ctx.getImageData(textX, textY - fontSize, textMetrics.width, fontSize);

         particleText = [];

         const adjustment = 5;  // Adjust this value for better positioning
         for (let y = 0, y2 = textCoordinates.height; y < y2; y++) {
             for (let x = 0, x2 = textCoordinates.width; x < x2; x++) {
                 if (textCoordinates.data[(y * 4 * textCoordinates.width) + (x * 4) + 3] > 128) {
                     let positionX = textX + x * adjustment;
                     let positionY = textY - fontSize + y * adjustment;
                     let color = 'white';
                     particleText.push(new Particle(positionX, positionY, 3, color, 0));
                 }
             }
         }
     }

     function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const element of particleText) {
            element.update();
            element.draw();
        }

        requestAnimationFrame(animate);
    }


    drawText();
    animate();
});
