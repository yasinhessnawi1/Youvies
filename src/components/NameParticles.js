import React, { useEffect, useRef } from 'react';

const NameParticles = ({ text = "Youvies", logoSrc }) => {
    const canvasRef = useRef(null);
    const particleText = useRef([]);
    const mouse = useRef({ x: null, y: null, radius: 50 });
    const animationFrameRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const setCanvasSize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        const handleResize = () => {
            setCanvasSize();
            drawContent();
        };

        const handleMouseMove = (event) => {
            mouse.current.x = event.x;
            mouse.current.y = event.y;
        };

        window.addEventListener('resize', handleResize);
        canvas.addEventListener('mousemove', handleMouseMove);

        setCanvasSize();
        drawContent();

        return () => {
            window.removeEventListener('resize', handleResize);
            canvas.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameRef.current);
        };
    }, [text, logoSrc]);

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
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, true);
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

        const fontSize = Math.min(20, canvas.width / 20);
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = 'white';

        const textWidth = ctx.measureText(text).width;
        const textX = outerWidth  / 2 - textWidth / 2 - fontSize * 10;
        const textY = fontSize ; // Adjust the Y position to be 1.5 times the font size from the top

        ctx.fillText(text, textX, textY);

        if (logoSrc) {
            const logoImg = new Image();
            logoImg.src = logoSrc;
            logoImg.onload = () => {
                const logoWidth = fontSize; // Make logo size proportional to font size
                const logoHeight = fontSize;
                const logoX = textX + textWidth * 5 + fontSize / 2;
                const logoY = textY ; // Adjust Y to be aligned just below the text
                ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
                captureParticleCoordinates(textX, textY - fontSize, textWidth, fontSize, logoX, logoY, logoWidth, logoHeight);

                animate();
            };
            logoImg.onerror = (e) => {
                console.error("Failed to load logo image.", e);
                captureParticleCoordinates(textX, textY - fontSize, textWidth, fontSize);
                animate();
            };
        } else {
            captureParticleCoordinates(textX, textY - fontSize, textWidth, fontSize);
            animate();
        }
    };

    const captureParticleCoordinates = (textX, textY, textWidth, textHeight, logoX = null, logoY = null, logoWidth = 0, logoHeight = 0) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const textCoordinates = ctx.getImageData(textX, textY, textWidth, textHeight);

        particleText.current = [];
        const adjustment = 5;

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

        if (logoX !== null && logoY !== null && logoWidth > 0 && logoHeight > 0) {
            const logoCoordinates = ctx.getImageData(logoX, logoY, logoWidth, logoHeight);
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
    };

    const animate = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (particleText.current.length === 0) {
            return;
        }

        for (const element of particleText.current) {
            element.update(ctx);
        }

        animationFrameRef.current = requestAnimationFrame(animate);
    };

    return <canvas ref={canvasRef} id="name-particle-canvas" />;
};

export default NameParticles;
