import React, { useEffect, useRef } from 'react';

const NameParticles = () => {
    const canvasRef = useRef(null);
    const particleText = useRef([]);
    const mouse = useRef({ x: null, y: null, radius: 50 });

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            drawContent();
        };

        const handleMouseMove = (event) => {
            mouse.current.x = event.x;
            mouse.current.y = event.y;
        };

        window.addEventListener('resize', handleResize);
        canvas.addEventListener('mousemove', handleMouseMove);

        drawContent();

        return () => {
            window.removeEventListener('resize', handleResize);
            canvas.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    class Particle {
        constructor(x, y, size, color) {
            this.x = x;
            this.y = y;
            this.size = size;
            this.color = color;
            this.baseX = this.x;
            this.baseY = this.y;
            this.density = Math.random() * 10000 + 1;
        }

        draw(ctx) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.fill();
        }

        update(ctx) {
            let dx = mouse.current.x - this.x;
            let dy = mouse.current.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            let forceDirectionX = dx / distance;
            let forceDirectionY = dy / distance;
            let maxDistance = mouse.current.radius;
            let force = (maxDistance - distance) / maxDistance * 2;
            let directionX = forceDirectionX * force * this.density;
            let directionY = forceDirectionY * force * this.density;

            if (distance < mouse.current.radius) {
                this.x -= directionX;
                this.y -= directionY;
            } else {
                if (this.x !== this.baseX) {
                    let dx = this.x - this.baseX;
                    this.x -= dx / 35;
                }
                if (this.y !== this.baseY) {
                    let dy = this.y - this.baseY;
                    this.y -= dy / 35;
                }
            }

            this.draw(ctx);
        }
    }

    const drawContent = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Temporarily draw text and logo on the canvas to get their coordinates
        const textElement = document.querySelector('.text');
        const logoElement = document.querySelector('.logo');

        if (textElement) {
            console.log('Found text element.');
            const textRect = textElement.getBoundingClientRect();
            const textX = (canvas.width - textRect.width)  / 2.5;
            const textY = 50; // Adjust the Y position as needed
            console.log(`Text coordinates: (${textX}, ${textY})`);

            // Draw text on the canvas
            ctx.font = getComputedStyle(textElement).font;
            ctx.fillStyle = 'white';
            ctx.fillText(textElement.innerText, textX, textY + textRect.height);

            // Draw bounding box around text for debugging



            // Handle logo separately
            if (logoElement) {
                console.log('Found logo element.');
                const logoRect = logoElement.getBoundingClientRect();
                const logoX = textX + textRect.width + 10; // Adjust spacing between text and logo
                const logoY = textY - textRect.height / 2; // Center logo vertically with text
                console.log(`Logo coordinates: (${logoX}, ${logoY})`);

                const logoImg = new Image();
                logoImg.src = logoElement.src;
                logoImg.onload = () => {
                    console.log('Drawing text and logo on canvas...');
                    ctx.drawImage(logoImg, logoX, logoY, logoRect.width, logoRect.height);

                    // Draw bounding box around logo for debugging
                    ctx.strokeStyle = 'blue';
                    ctx.strokeRect(logoX, logoY, logoRect.width, logoRect.height);

                    captureParticleCoordinates(textX, textY, textRect.width, textRect.height, logoX, logoY, logoRect.width, logoRect.height);
                    animate();
                };
                logoImg.onerror = (e) => {
                    console.error("Failed to load logo image.", e);
                    // Proceed without the logo if it fails to load
                    captureParticleCoordinates(textX, textY, textRect.width, textRect.height);
                    animate();
                };
            } else {
                console.error("Logo element not found.");
                captureParticleCoordinates(textX, textY, textRect.width, textRect.height);
                animate();
            }
        } else {
            console.error("Text element not found.");
        }
    };

    const captureParticleCoordinates = (textX, textY, textWidth, textHeight, logoX = null, logoY = null, logoWidth = 0, logoHeight = 0) => {

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const textCoordinates = ctx.getImageData(textX, textY, textWidth, textHeight);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log('Text image data:', textCoordinates);

        particleText.current = [];
        const adjustment = 6;

        console.log('Capturing particle coordinates from text...');
        for (let y = 0; y < textCoordinates.height; y++) {
            for (let x = 0; x < textCoordinates.width; x++) {
                const alpha = textCoordinates.data[(y * 4 * textCoordinates.width) + (x * 4) + 3];
                if (alpha > 128) {
                    let positionX = textX + x * adjustment;
                    let positionY = textY + y * adjustment;
                    let color = 'white';
                    particleText.current.push(new Particle(positionX, positionY, 3, color));
                }
            }
        }

        console.log(`Particles from text: ${particleText.current.length}`);

        if (logoX !== null && logoY !== null && logoWidth > 0 && logoHeight > 0) {
            console.log('Capturing particle coordinates from logo...');
            const logoCoordinates = ctx.getImageData(logoX, logoY, logoWidth, logoHeight);
            console.log('Logo image data:', logoCoordinates);
            for (let y = 0; y < logoCoordinates.height; y++) {
                for (let x = 0; x < logoCoordinates.width; x++) {
                    const alpha = logoCoordinates.data[(y * 4 * logoCoordinates.width) + (x * 4) + 3];
                    if (alpha > 128) {
                        let positionX = logoX + x * adjustment;
                        let positionY = logoY + y * adjustment;
                        let color = 'white';
                        particleText.current.push(new Particle(positionX, positionY, 3, color));
                    }
                }
            }
        }

        console.log(`Total particles captured: ${particleText.current.length}`);
    };

    const animate = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (particleText.current.length === 0) {
            console.log('No particles to animate.');
            return;
        }

        for (const element of particleText.current) {
            element.update(ctx);
        }

        requestAnimationFrame(animate);
    };

    return <canvas ref={canvasRef} id="name-particle-canvas" />;
};

export default NameParticles;
