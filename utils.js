export class SubRenderer {
	/**
	 * @param {number} id
	 */
	constructor(id) {
		this.id = id
		this.worker = new Worker('worker.js')
		this.worker.onmessage = this._onWorkerMessage.bind(this)
		this.buf = new Uint32Array(0)
		this._job = /** @type {null | {onRendered: () => void, promise:Promise<void>}} */ (null)
	}
	/** @param {MessageEvent<any>} e */
	_onWorkerMessage(e) {
		if (e.data.cmd === 'rendered') {
			if (!this._job) throw new Error('is not rendering')
			this.buf = e.data.buf
			const onRendered = this._job.onRendered
			this._job = null
			onRendered()
		}
	}
	_resize(w, h) {
		if (w * h * 3 !== this.buf.length) this.buf = new Uint32Array(w * h * 3)
	}
	render(w, h, seed, ...args) {
		if (this._job) throw new Error('already rendering')
		let resolve = /** @type {null | (() => void)} */ (null)
		const promise = new Promise((resolve_, reject) => {
			this._resize(w, h)
			this.worker.postMessage({ cmd: 'render', buf: this.buf, w, h, seed, args }, [this.buf.buffer])
			resolve = /** @type {() => void} */ (resolve_)
		})
		this._job = { onRendered: mustBeNotNull(resolve), promise }
		return promise
	}
	wait() {
		return this._job ? this._job.promise : Promise.resolve()
	}
	isWorking() {
		return !!this._job
	}
	hardReset() {
		this.worker.terminate()
		this.worker = new Worker('worker.js')
		this.worker.onmessage = this._onWorkerMessage.bind(this)
		if (this._job) this._job.onRendered()
		this._job = null
		this.buf.fill(0)
	}
	addBufTo(buf) {
		for (let i = 0; i < this.buf.length; i++) {
			buf[i] += this.buf[i]
		}
	}
}

/**
 * @template T
 * @param {T|null} val
 * @returns {T}
 */
export function mustBeNotNull(val) {
	if (val === null) throw new Error('value must not be null')
	return val
}

/**
 * @template {{ new (...args: any): any }[]} T
 * @param {unknown} obj
 * @param  {T} classes
 * @returns {InstanceType<T[number]>}
 */
export function mustBeInstanceOf(obj, ...classes) {
	for (const class_ of classes) {
		if (obj instanceof class_) return obj
	}
	throw new Error(`object must be ${classes.map(x => x.name).join('|')}, got ${obj}`)
}

/**
 * @template {{ new (...args: any): any }} T
 * @param {string} id
 * @param {T} class_
 * @returns {InstanceType<T>}
 */
export function getById(id, class_) {
	const el = document.getElementById(id)
	if (el === null) throw new Error('no element with id ' + id)
	return mustBeInstanceOf(el, class_)
}

/**
 * @param {number} mills
 */
export function sleep(mills) {
	return new Promise(resolve => setTimeout(resolve, mills))
}