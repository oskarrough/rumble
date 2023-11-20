import {Node, Loop, Task} from 'vroum'
import {render, random} from './utils.js'
import {UI} from './ui.js'

export class GameLoop extends Loop {
	constructor(props) {
		super()
		// The DOM element to render to
		this.element = props.element
	}

	build() {
		return [Player.new(), AI.new(), Board.new(), Renderer.new()]
	}

	mount() {
		this.subscribe('start', () => {
			this.query(Renderer).render()
		})
		this.subscribe('stop', () => {
			this.query(Renderer).render()
		})
		this.subscribe('play', () => {
			this.query(Renderer).render()
		})
		this.subscribe('pause', () => {
			this.query(Renderer).render()
		})
	}

	destroy() {
		this.query(Renderer).render()
	}
}

class Renderer extends Task {
	delay = 0
	duration = 0
	interval = 32
	repeat = Infinity

	tick() {
		this.render()
	}

	render() {
		if (!this.root?.element) throw new Error('missing DOM element to render to')
		render(this.root.element, UI(this.root))
	}
}

class Participant extends Task {
	health = 3

	build() {
		return [new Gold(), new Minion(), new Minion(), new Minion(), new Minion(), new RefillMinions()]
	}

	afterCycle() {
		if (this.health <= 0) {
			console.log(`${this.constructor.name} lost`)
			this.parent.stop()
		}
	}
}

export class Player extends Participant {}

export class AI extends Participant {}

export class Gold extends Task {
	delay = 0
	duration = 0
	interval = 1000
	repeat = Infinity

	amount = 0
	maxAmount = 10

	tick() {
		this.increment()
	}

	increment(value = 1) {
		if (this.amount === this.maxAmount) return
		this.amount = this.amount + value
	}

	decrement(value = 1) {
		if (this.amount < 2) return 0
		this.amount = this.amount - value
	}
}

/** Adds a new minion to the parent every {interval} seconds (if we have less than 4) */
export class RefillMinions extends Task {
	duration = 0
	interval = 3000

	tick() {
		if (this.parent.queryAll(Minion)?.length < 4) {
			this.parent.add(Minion.new())
		}
	}
}

const MINION_TYPES = ['rock', 'paper', 'scissors']

export class Minion extends Task {
	delay = 1000
	duration = 0
	interval = 1000
	repeat = Infinity
	// Props
	minionType = ''
	speed = 1
	y = 0
	cost = 2

	constructor() {
		super()
		this.minionType = random(MINION_TYPES)
	}

	tick() {
		if (!this.deployed) return
	}

	afterCycle() {
		if (!this.deployed) return

		const isAI = this.parent.is(AI)
		const startY = isAI ? this.root.query(Board).height : 0
		const finalY = isAI ? 0 : this.root.query(Board).height
		const opponent = this.root.query(isAI ? Player : AI)

		// Fight any enemies on same Y, and remove the loser.
		if (this.y !== startY && this.y !== finalY) {
			const enemies = this.findEnemies(opponent)
			for (const enemy of enemies) {
				const loser = this.fight(enemy)
				loser.disconnect()
			}
		}

		// If we reached the opposite end, opponent player loses a life, and we leave the board.
		if (this.y === finalY) {
			opponent.health--
			this.disconnect()
			return
		}

		this.move(isAI ? -1 : 1)
	}

	/**
	 * Deploys the minion, meaning it's on the board now.
	 */
	deploy() {
		// Handle gold
		if (this.parent.query(Gold).amount < this.cost) {
			console.log(`You need ${this.cost} gold to deploy this minion`)
			return
		}
		this.parent.query(Gold).decrement(this.cost)
		// Deploy to the starting side of the board.
		const isAI = this.parent.is(AI)
		this.y = isAI ? this.root.query(Board).height : 0
		this.deployed = this.root.elapsedTime
		console.log('ACTION deploy', isAI ? 'AI' : 'Player', this.minionType, this.y)
	}

	move(direction = 1) {
		this.y = Math.max(0, this.y + this.speed * direction)
	}

	/**
	 * Returns the losing minion, if draw return a random winner
	 * @argument {Participant} opponent
	 */
	fight(opponent) {
		const isAI = this.parent.is(AI)
		console.log('ACTION fight', this.y, isAI ? 'AI' : 'Player', this.minionType, 'vs', opponent.minionType)
		const winningCombos = {
			rock: 'scissors',
			paper: 'rock',
			scissors: 'paper',
		}
		if (winningCombos[this.minionType] === opponent.minionType) {
			return opponent
		} else if (winningCombos[opponent.minionType] === this.minionType) {
			return this
		} else {
			return random([this, opponent])
		}
	}

	/**
	 * Returns any non-friendly minions on the same position.
	 * @argument {Participant} opponent
	 */
	findEnemies(opponent) {
		return opponent.queryAll(Minion).filter((minion) => minion.y === this.y)
	}
}

export class Board extends Node {
	width = 1
	height = 7
}
