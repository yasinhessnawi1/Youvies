import React, { useEffect } from 'react';
import { createNoise3D } from 'simplex-noise';
import '../styles/ParticleBackground.css';

const ParticleAnimation = () => {
    useEffect(() => {
        let canvas, ctx, field, w, h, fieldSize, columns, rows, noiseZ, particles, hue;
        noiseZ = 0;
        const particleCount = 2000;
        const particleSize = 0.9;
        fieldSize = 70;
        const fieldForce = 0.15;
        const noiseSpeed = 0.0003;
        const sORp = true;
        const trailLength = 0.15;
        const hueBase = 10;
        const hueRange = 5;
        const maxSpeed = 2.3;

        class Vector {
            constructor(x, y) {
                this.x = x;
                this.y = y;
            }

            addTo(v) {
                this.x += v.x;
                this.y += v.y;
            }

            setLength(length) {
                const angle = this.getAngle();
                this.x = Math.cos(angle) * length;
                this.y = Math.sin(angle) * length;
            }

            setAngle(angle) {
                const length = this.getLength();
                this.x = Math.cos(angle) * length;
                this.y = Math.sin(angle) * length;
            }

            getLength() {
                return Math.sqrt(this.x * this.x + this.y * this.y);
            }

            getAngle() {
                return Math.atan2(this.y, this.x);
            }

            div(scalar) {
                return new Vector(this.x / scalar, this.y / scalar);
            }
        }

        class Particle {
            constructor(x, y) {
                this.pos = new Vector(x, y);
                this.vel = new Vector(Math.random() - 0.5, Math.random() - 0.5);
                this.acc = new Vector(0, 0);
                this.hue = Math.random() * 30 - 15;
            }

            move(acc) {
                if (acc) {
                    this.acc.addTo(acc);
                }
                this.vel.addTo(this.acc);
                this.pos.addTo(this.vel);
                if (this.vel.getLength() > maxSpeed) {
                    this.vel.setLength(maxSpeed);
                }
                this.acc.setLength(0);
            }

            wrap() {
                if (this.pos.x > w) {
                    this.pos.x = 0;
                } else if (this.pos.x < -this.fieldSize) {
                    this.pos.x = w - 1;
                }
                if (this.pos.y > h) {
                    this.pos.y = 0;
                } else if (this.pos.y < -this.fieldSize) {
                    this.pos.y = h - 1;
                }
            }
        }

        canvas = document.querySelector("#canvas");
        ctx = canvas.getContext("2d");
        reset();
        window.addEventListener("resize", reset);

        function initParticles() {
            particles = [];
            let numberOfParticles = particleCount;
            for (let i = 0; i < numberOfParticles; i++) {
                let particle = new Particle(Math.random() * w, Math.random() * h);
                particles.push(particle);
            }
        }

        function initField() {
            field = new Array(columns);
            for (let x = 0; x < columns; x++) {
                field[x] = new Array(rows);
                for (let y = 0; y < rows; y++) {
                    let v = new Vector(0, 0);
                    field[x][y] = v;
                }
            }
        }

        function calcField() {
            const noise3D = createNoise3D();
            if (sORp) {
                for (let x = 0; x < columns; x++) {
                    for (let y = 0; y < rows; y++) {
                        let angle = noise3D(x / 20, y / 20, noiseZ) * Math.PI * 2;
                        let length = noise3D(x / 40 + 40000, y / 40 + 40000, noiseZ) * fieldForce;
                        field[x][y].setLength(length);
                        field[x][y].setAngle(angle);
                    }
                }
            } else {
                for (let x = 0; x < columns; x++) {
                    for (let y = 0; y < rows; y++) {
                        let angle = noise3D(x / 20, y / 20, noiseZ) * Math.PI * 2;
                        let length = noise3D(x / 40 + 40000, y / 40 + 40000, noiseZ) * fieldForce;
                        field[x][y].setLength(length);
                        field[x][y].setAngle(angle);
                    }
                }
            }
        }

        function reset() {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
            noiseZ = Math.random();
            columns = Math.round(w / fieldSize) + 1;
            rows = Math.round(h / fieldSize) + 1;
            initParticles();
            initField();
        }

        function draw() {
            requestAnimationFrame(draw);
            calcField();
            noiseZ += noiseSpeed;
            drawBackground();
            drawParticles();
        }

        function drawBackground() {
            ctx.fillStyle = "rgba(0,0,0," + trailLength + ")";
            ctx.fillRect(0, 0, w, h);
        }

        function drawParticles() {
            particles.forEach(p => {
                var ps = (p.fieldSize = Math.abs(p.vel.x + p.vel.y) * particleSize + 0.3);
                ctx.fillStyle = "hsl(" + (hueBase + p.hue + (p.vel.x + p.vel.y) * hueRange) + ", 100%, 50%)";
                ctx.fillRect(p.pos.x, p.pos.y, ps, ps);
                let pos = p.pos.div(fieldSize);
                let v;
                if (pos.x >= 0 && pos.x < columns && pos.y >= 0 && pos.y < rows) {
                    v = field[Math.floor(pos.x)][Math.floor(pos.y)];
                }
                p.move(v);
                p.wrap();
            });
        }

        draw();
    }, []);

    return <canvas id="canvas"></canvas>;
};

export default ParticleAnimation;
