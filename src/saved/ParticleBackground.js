import React, { useEffect, useRef } from 'react';
import { createNoise3D } from 'simplex-noise';

const ParticleBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    let canvas = canvasRef.current;

    let ctx = canvas.getContext('2d');
    let field, w, h, fieldSize, columns, rows, noiseZ, particles;
    noiseZ = 0;
    const particleCount = 2000;
    const particleSize = 0.9;
    fieldSize = 70;
    const fieldForce = 0.15;
    const noiseSpeed = 0.0003;
    const trailLength = 0.15;
    const hueBase = 0;
    const hueRange = 5;
    const maxSpeed = 2.6;

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
        this.vel = new Vector(Math.random() * 10, Math.random());
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

    const reset = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      noiseZ = Math.random();
      columns = Math.round(w / fieldSize) + 1;
      rows = Math.round(h / fieldSize) + 1;
      initParticles();
      initField();
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        let particle = new Particle(Math.random() * w, Math.random() * h);
        particles.push(particle);
      }
    };

    const initField = () => {
      field = new Array(columns);
      for (let x = 0; x < columns; x++) {
        field[x] = new Array(rows);
        for (let y = 0; y < rows; y++) {
          field[x][y] = new Vector(0, 0);
        }
      }
    };

    const calcField = () => {
      const noise3D = createNoise3D();

      for (let x = 0; x < columns; x++) {
        for (let y = 0; y < rows; y++) {
          let angle = noise3D(x / 20, y / 20, noiseZ) * Math.PI * 2;
          let length = noise3D(x / 40, y / 40, noiseZ) * fieldForce;
          field[x][y].setLength(length);
          field[x][y].setAngle(angle);
        }
      }
    };

    const draw = () => {
      requestAnimationFrame(draw);
      calcField();
      noiseZ += noiseSpeed;
      drawBackground();
      drawParticles();
    };

    const drawBackground = () => {
      ctx.fillStyle = `rgb(35, 4, 0)`;
      ctx.fillRect(0, 0, w, h);
    };

    const drawParticles = () => {
      particles.forEach((p) => {
        let ps = (p.fieldSize =
          Math.abs(p.vel.x + p.vel.y) * particleSize + 0.3);
        ctx.fillStyle = `hsl(${hueBase + p.hue + (p.vel.x + p.vel.y) * hueRange}, 100%, 35%)`;
        ctx.fillRect(p.pos.x, p.pos.y, ps, ps);
        let pos = p.pos.div(fieldSize);
        let v;
        if (pos.x >= 0 && pos.x < columns && pos.y >= 0 && pos.y < rows) {
          v = field[Math.floor(pos.x)][Math.floor(pos.y)];
        }
        p.move(v);
        p.wrap();
      });
    };

    reset();
    draw();

    window.addEventListener('resize', reset);

    return () => {
      window.removeEventListener('resize', reset);
    };
  }, []);

  return <canvas ref={canvasRef} id='background-particle-canvas' />;
};

export default ParticleBackground;
