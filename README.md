# Super Mario 3D Web Game

![Super Mario 3D](https://github.com/bomb1000/Cursor_Practice/blob/main/SuperMario/screenshot.png)

A 3D platformer game inspired by Super Mario, built entirely with HTML, JavaScript, and Three.js. Experience classic Mario gameplay elements in 3D space directly in your browser.

[Play Game](https://bomb1000.github.io/Cursor_Practice/SuperMario/index.html)

## Features

- **3D Graphics**: Fully interactive 3D environment rendered with Three.js
- **Classic Platformer Gameplay**: Jump, collect coins, defeat enemies, and navigate platforms
- **Power-ups**: Collect mushrooms to grow larger and fire flowers to shoot fireballs
- **Question Blocks**: Hit question blocks from below to reveal power-ups
- **Enemies**: Jump on Goombas to defeat them or use fireballs when powered up
- **Audio System**: Dynamic background music and sound effects using Web Audio API
- **Lives and Score System**: Track your progress with lives and scoring
- **Game Over Screen**: Restart the game when you lose all lives
- **Camera Controls**: Adjustable camera angles and distance from the character

## Controls

- **Movement**: Arrow keys or WASD to move the character
- **Jump**: Space bar
- **Fire**: F key (when you have fire flower power-up)
- **Camera Height**: Up/Down arrow keys
- **Camera Angle**: Click and drag with the mouse to rotate camera

## Game Mechanics

### Power-ups

- **Mushroom**: Makes your character larger and gives you an extra hit point
- **Fire Flower**: Gives you the ability to shoot fireballs at enemies

### Obstacles

- **Platforms**: Various platforms at different heights to navigate
- **Question Blocks**: Hit them from below to reveal coins, mushrooms, or fire flowers
- **Goombas**: Classic Mario enemies that will cause you to lose a life if touched

### Scoring

- **Coins**: +10 points
- **Defeating a Goomba**: +200 points
- **Collecting a Power-up**: +50 points

## Technical Details

### Technologies Used

- **HTML5/CSS3**: Game container and UI elements
- **JavaScript**: Game logic and mechanics
- **Three.js**: 3D rendering and physics
- **Web Audio API**: Sound generation and audio effects

### Performance Optimization

- Efficient collision detection algorithms
- Object pooling for frequent particle effects
- Optimized 3D models with low polygon counts
- Camera frustum culling for improved rendering performance

### Custom Features

- Procedurally generated textures for question blocks
- Dynamic lighting with shadow mapping
- Flexible camera system with collision prevention
- Custom sound synthesis for authentic 8-bit style audio

## Development

This project was created as a demonstration of web-based 3D game development using modern JavaScript techniques and the Three.js library. The entire game is contained in a single HTML file for ease of deployment and sharing.

## Future Enhancements

- Mobile touch controls
- Additional levels and worlds
- More enemy types and obstacles
- Local high score storage
- Custom character selection

## License

This project is open source and available under the MIT License.

---

Created with ❤️ using JavaScript and Three.js
