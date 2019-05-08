// phaser game config
var config = {
    type: Phaser.AUTO,
    width: 16 * 21 * 3,
    height: 12 * 21 * 3,
    scene: {
        preload: preload,
        create: create,
        update: update,
        key: "level1"
    },

    pixelArt: true,

    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 650 },
            debug: false
        }
    },


    callbacks: {
        postBoot: function () {
            resize();
        }
    },

    input: {
        gamepad: true
    }

};

// initialise game & variables
var game = new Phaser.Game(config);
var player;
var cursors;
var airEnemies;
var score = 0, scoreText;
var music = {}, sfx = {};
var VEL_X = 100;
var VEL_Y = 250;
var pad, padAOnce;

// ************ PHASER.SCENE BUILT-IN FUNCTIONS ************ //
function preload() {

    //Load files for map & images
    this.load.image("platform", "../assets/blankPlatform.png");
    this.load.image("spritesheet", "../assets/spritesheet.png");
    this.load.tilemapTiledJSON("tilemap", "../assets/level.json");

    //Load spritesheets
    this.load.spritesheet(
        "player",
        "../assets/player.png",
        { frameWidth: 21, frameHeight: 21 }
    );

    this.load.spritesheet(
        "coin",
        "../assets/coin-sheet.png",
        { frameWidth: 16, frameHeight: 16 }
    );

    this.load.spritesheet(
        "groundEnemy",
        "../assets/groundEnemy-sheet.png",
        { frameWidth: 21, frameHeight: 10 }
    );

    this.load.spritesheet(
        "airEnemy",
        "../assets/airEnemy-sheet.png",
        { frameWidth: 21, frameHeight: 10 }
    );

    //Load audio files
    this.load.audio("overgroundMusic", "../assets/audio/mayastheme.mp3");
    this.load.audio("undergroundMusic", "../assets/audio/mayastheme_recollection.mp3");
    this.load.audio("victoryMusic", "../assets/audio/victory.mp3");
    this.load.audio("jumpSFX", "../assets/audio/sfx-selectblip.wav");
    this.load.audio("hurtSFX", "../assets/audio/sfx-bvvt.wav");
    this.load.audio("pickupSFX", "../assets/audio/sfx-bling2.wav");
}

function create() {

    window.addEventListener("resize", resize, false);


    //Start loading in the tilemap here
    var map = this.make.tilemap({ key: "tilemap" });
    var spritesheet = map.addTilesetImage("spritesheet-tileset", "spritesheet"); // name in Tiled, key

    map.createStaticLayer("background", [spritesheet], 0, 0); // layer name in Tiled, tilesets used, x, y
    map.createStaticLayer("scrollingBg", [spritesheet], 0, 0).setScrollFactor(0.5, 1);
    map.createStaticLayer("midground", [spritesheet], 0, 0);
    map.createStaticLayer("decorationLayer", [spritesheet], 0, 0);
    map.createStaticLayer("platformLayer", [spritesheet], 0, 0);

    var collisionLayer = map.createStaticLayer("collisionLayer", [spritesheet], 0, 0);
    collisionLayer.setCollisionBetween(0, 1000);

    var playerSpawn = map.findObject("objectLayer", function (object) {
        if (object.name === "playerSpawn") {
            return object;
        }
    });

    platforms = this.physics.add.staticGroup();
    var platform = map.findObject("objectLayer", function (obj) {
        if (obj.name === "platform") {
            platforms.create(obj.x + (obj.width / 2), obj.y + (obj.height / 2), "platform").setScale(obj.width / 10, 1).refreshBody();
        }
    });
    platforms.toggleVisible();

    enemyCollisionBoxes = this.physics.add.staticGroup();
    var enemyCollisionBox = map.findObject("objectLayer", function (obj) {
        if (obj.name === "enemyCollision") {
            enemyCollisionBoxes.create(obj.x + (obj.width / 2), obj.y + (obj.height / 2), "platform").setScale(obj.width / 10, obj.height / 10).refreshBody();
        }
    })
    enemyCollisionBoxes.toggleVisible();

    var undergroundArea = map.findObject("objectLayer", function (object) {
        if (object.name === "underground") {
            // TODO create hit box
        }
    })

    coins = this.physics.add.staticGroup();
    groundEnemies = this.physics.add.group();
    airEnemies = this.physics.add.group();

    //Create air enemies

    this.anims.create({
        key: 'airEnemyAnims',
        frames: this.anims.generateFrameNumbers('airEnemy', { start: 0, end: 1 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'airEnemyDead',
        frames: this.anims.generateFrameNumbers('airEnemy', { start: 2, end: 2 }),
        frameRate: 1,
        repeat: -1
    });

    var airEnemySpawn, airEnemyDest, line, airEnemy;
    var airEnemyPoints = findPoints.call(this, map, 'objectLayer', 'airEnemy');
    var len = airEnemyPoints.length / 2;
    for (var i = 1; i < len + 1; i++) {
        airEnemySpawn = findPoint.call(this, map, 'objectLayer', 'airEnemy', 'airEnemySpawn' + i);
        airEnemyDest = findPoint.call(this, map, 'objectLayer', 'airEnemy', 'airEnemyDest' + i);
        line = new Phaser.Curves.Line(airEnemySpawn, airEnemyDest);
        airEnemy = this.add.follower(line, airEnemySpawn.x, airEnemySpawn.y, 'airEnemy');
        airEnemy.startFollow({
            duration: Phaser.Math.Between(1500, 2500),
            repeat: -1,
            yoyo: true,
            ease: 'Sine.easeInOut',
            rotateToPath: true,
            verticalAdjust: true
        });
        airEnemy.anims.play('airEnemyAnims', true);
        airEnemies.add(airEnemy);
        airEnemy.body.allowGravity = false;
        airEnemy.setFlipX(true);
    }

    //Find objects and create sprite for relevant group
    map.findObject("objectLayer", function (object) {
        if (object.name === "pickUp") {
            coins.create(object.x + map.tileWidth / 2, object.y - map.tileHeight / 2, "coin");
        }
    });

    createPlayer.call(this, playerSpawn);
    createEnemies.call(this);

    //Change camera settings
    var camera = this.cameras.getCamera("");
    camera.zoom = 3;
    camera.startFollow(player);
    camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    createObjectAnimations.call(this);
    createKeys.call(this);
    createScoreText.call(this);

    this.physics.add.collider(player, collisionLayer);
    this.physics.add.collider(groundEnemies, enemyCollisionBoxes);
    this.physics.add.collider(player, platforms);
    this.physics.add.overlap(player, coins, pickUpCoin);
    this.physics.add.overlap(player, groundEnemies, onHit);
    this.physics.add.overlap(player, airEnemies, airEnemyAttack);

    //Create sounds
    music.overground = this.sound.add("overgroundMusic", { loop: true, volume: 0.5 });
    music.underground = this.sound.add("undergroundMusic", { loop: true, volume: 0.5 });
    music.victory = this.sound.add("victoryMusic", { loop: true, volume: 0.5 });

    sfx.jump = this.sound.add("jumpSFX");
    sfx.hurt = this.sound.add("hurtSFX");
    sfx.pickup = this.sound.add("pickupSFX");
}

function update() {
    checkPlayerMovement();
    checkGroundEnemyMovement();

    if (!music.victory.isPlaying) {
        if ((!music.underground.isPlaying) && (player.body.y > 400)) {
            music.underground.play();
            music.overground.stop();
        } else if ((!music.overground.isPlaying) && (player.body.y < 400)) {
            music.overground.play();
            music.underground.stop();
        }
    }

    coins.playAnimation("coinAnims", true);
    groundEnemies.playAnimation("groundEnemyAnims", true);

    // gamepad
    if (this.input.gamepad.total === 0) {
        return;
    }
    pad = this.input.gamepad.getPad(0);
    if (pad.axes.length) {
        var axisH = pad.axes[0].getValue();
        if (axisH < 0) {
            player.setVelocityX(-VEL_X);
        } else if (axisH > 0) {
            player.setVelocityX(VEL_X);
        }
    }
    if (!pad.A) {
        padAOnce = false;
    }
    if (pad.A && !padAOnce && player.jumpCount < player.maxJump) {
        player.jumpCount++;
        player.setVelocityY(-VEL_Y);
        sfx.jump.play();
        padAOnce = true;
    }
}

//***************** NON PHASER.SCENE FUNCTIONS ************//
//*************** CREATE FUNCTIONS*************************//

//Create the player object from the playerSpawn location
function createPlayer(playerSpawn) {
    player = this.physics.add.sprite(playerSpawn.x, playerSpawn.y, 'player', 4);
    player.maxJump = 2;
    player.setCollideWorldBounds(true);

    createPlayerAnimations.call(this);
}

function createEnemies() {
    createGroundEnemy(10, 421);
    createGroundEnemy(150, 148);
    createGroundEnemy(380, 253);
    createGroundEnemy(740, 85);
    createGroundEnemy(910, 337);
    createGroundEnemy(1110, 148);
    createGroundEnemy(1325, 421);
    createGroundEnemy(1790, 253);
}

function createGroundEnemy(x, y) {
    var groundEnemy = groundEnemies.create(x, y, "groundEnemy");
    groundEnemy.startX = x;
    groundEnemy.y -= groundEnemy.height / 2;
    groundEnemy.setCollideWorldBounds(true);
    groundEnemy.setVelocityX(110);
    groundEnemy.setBounce(1);
    groundEnemy.body.setAllowGravity(false);
}

function airEnemyAttack(player, airEnemy) {
    airEnemy.stopFollow();
    airEnemy.anims.stop();
    airEnemy.anims.play('airEnemyDead');
}

//Create the cursor keys
function createKeys() {
    cursors = this.input.keyboard.createCursorKeys();
}

//Create the animations that the player will use
function createPlayerAnimations() {
    this.anims.create({
        key: 'walk',
        frames: this.anims.generateFrameNumbers('player', { start: 9, end: 10 }),
        frameRate: 15,
        repeat: -1
    });

    this.anims.create({
        key: 'idle',
        frames: this.anims.generateFrameNumbers('player', { frames: [0, 1] }),
        frameRate: 3,
        repeat: -1
    });


    this.anims.create({
        key: 'down',
        frames: this.anims.generateFrameNumbers('player', { frames: [3, 3] }),
        frameRate: 3,
        repeat: -1
    })

    this.anims.create({
        key: 'jump',
        frames: this.anims.generateFrameNumbers("player", { frames: [7, 7] }),
        frameRate: 15,
        repeat: -1
    });

    this.anims.create({
        key: 'fall',
        frames: this.anims.generateFrameNumbers("player", { frames: [4, 4] }),
        frameRate: 15,
        repeat: -1
    });
}

function createObjectAnimations() {
    this.anims.create({
        key: 'coinAnims',
        frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 5 }),
        frameRate: 10,
        repeat: -1,
    });

    this.anims.create({
        key: 'groundEnemyAnims',
        frames: this.anims.generateFrameNumbers('groundEnemy', { start: 0, end: 3 }),
        frameRate: 5,
        repeat: -1
    });
}

function createScoreText() {
    scoreText = this.add.text(345, 260, 'Score: 0', { fontSize: '12px', fill: '#000' }).setScrollFactor(0);
    scoreText.setOrigin(0);
    console.log(scoreText);
}

//*************** GAMEPLAY FUNCTIONS *************//

//Check for cursor key presses and move the player accordingly
function checkPlayerMovement() {
    //Right
    if (cursors.right.isDown) {
        player.setVelocityX(100);
        player.anims.play('walk', true);
        player.flipX = false;
    }
    //Left
    else if (cursors.left.isDown) {
        player.setVelocityX(-100);
        player.anims.play('walk', true);
        player.flipX = true;
    }
    //Down
    else if (cursors.down.isDown) {
        player.setVelocityX(0);
        player.anims.play('down', true);
    }
    //Idle
    else {
        player.setVelocityX(0);
        player.anims.play('idle', true);
    }

    //Reset jumpCount. Important for double jumping.
    if (player.body.blocked.down) {
        player.jumpCount = 0;
    }

    //Check for the spacebar having JUST been pressed, and whether the player has any jumps left - Important for double jumping.
    //Then, jump.
    if (Phaser.Input.Keyboard.JustDown(cursors.space) && player.jumpCount < player.maxJump) {
        player.jumpCount++;
        sfx.jump.play();
        player.setVelocityY(-250);
    }

    //Display jumping or falling animations
    if (player.body.velocity.y < 0) {
        player.anims.play('jump', true);
    } else if (player.body.velocity.y > 0) {
        player.anims.play('fall', true);
    }
}

function checkGroundEnemyMovement() {
    groundEnemies.children.iterate(function (groundEnemy) {
        if (groundEnemy.body.velocity.x > 0) {
            groundEnemy.flipX = true;
        } else if (groundEnemy.body.velocity.x < 0) {
            groundEnemy.flipX = false;
        }
    });
}

function gameWin() {
    player.setTint(0x00ff00);
    scoreText.setText("Score: " + score + " YOU WIN!");
    music.overground.stop();
    music.underground.stop();
    music.victory.play();
}

function updateScore(num) {
    score += num;
    scoreText.setText("Score: " + score);
    if (score === coins.getLength() * 2) {
        gameWin();
    }
}

function pickUpCoin(player, coin) {
    updateScore(2);
    coin.disableBody(true, true);
    //Play Sound
    sfx.pickup.play();
}

function onHit(player, enemy) {
    player.body.setVelocity(0, -200);
    sfx.hurt.play();
}

function resize() {
    var canvas = document.querySelector("canvas");
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;
    var windowRatio = windowWidth / windowHeight;
    var gameRatio = game.config.width / game.config.height;

    if (windowRatio < gameRatio) {
        canvas.style.width = windowWidth + "px";
        canvas.style.height = (windowWidth / gameRatio) + "px";
    }

    else {
        canvas.style.width = (windowHeight * gameRatio) + "px";
        canvas.style.height = windowHeight + "px";
    }
}



function findPoint(map, layer, type, name) {
    var loc = map.findObject(layer, function (object) {
        if (object.type === type && object.name === name) {
            //console.log(object);
            return object;
        }
    });
    return loc
}

function findPoints(map, layer, type) {
    //var locs = map.filterObjects(layer, obj => obj.type === type);
    var locs = map.filterObjects(layer, function (object) {
        if (object.type === type) {
            return object
        }
    });
    return locs
}