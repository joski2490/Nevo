var Nevo = function(brain) {

	this.type = 'n';
	this.id = parseInt(Math.random()*1000);
	// Descriptors
	this.pos = new Vec(Math.random()*world.w, Math.random()*world.h);
	this.rot = Math.random()*Math.PI*2;
	this.linVel = 0;
	this.angVel = 0;
	this.life = 0;
	this.age = 0;
	this.gen = null;
	this.children = [];
	this.lat = null;

	// The number of sections the view is splitted in (max 360)
	this.viewAccuracy = 30;

	// The view range
	this.viewRange = Math.PI/4;


	// The nevo view
	this.view = {};
	for(var i = -this.viewRange/Math.PI*180; i < this.viewRange/Math.PI*180; i+= this.viewRange/Math.PI*180*2/this.viewAccuracy) {
		this.view[i] = null;
	}

	// The nevo memory
	this.memory = [];
	for(var i = 0; i < 0; i++)
		this.memory.push({});

	// The brain
	if(brain == null) {
		this.brain = new Brain([this.viewAccuracy*2+6, 5, 3, 3]);
		//this.brain = new NNetwork();
		//this.brain.add(new NLayer(this.viewAccuracy*2+6));
		//this.brain.add(new NLayer(6));
		//this.brain.add(new NLayer(3));
	} else {
		this.brain = brain;
	}

	// The fitness evaluation property
	this.eaten = 0;

	// Accelerations
	this.linAcc = 0;
	this.angAcc = 0;

	// Limits
	this.maxLinVel = 1.4;
	this.maxLinAcc = this.maxLinVel/40;

	this.maxAngVel = Math.PI/16.0;
	this.maxAngAcc = this.maxAngVel/20;

	this.maxLife = 3000;
	this.life = this.maxLife/4;


	// The Vec to follow
	this.follow = null;

	// The creature radius
	this.radius = 5;


	// The creature color
	this.color = [100,100,100];
	this.highlight = null;
}

Nevo.prototype.addToTree = function(tree) {
	tree.push({
		color: this.color.join(','),
		time: world.age,
		children: this.children
	});
}

Nevo.prototype.eat = function(obj, force) {

	if(obj.type == 'n') {
		if(force) {
			this.life+= obj.life;
			this.eaten++;
			world.remove(obj);
			if (this.fitness() > world.bestFitness) world.bestFitness = this.fitness();
		} else {
			if(Math.abs(this.color[0]-obj.color[0]) < 50)
				return;
			if(this.color[0] > obj.color[0]) {
				this.eat(obj, true);
			} else {
				obj.eat(this, true);
			}
			return;
		}
	} else {
		if(this.color[0] > obj.color[0]) {
			this.life+= obj.energy;
			this.eaten++;
			if (this.fitness() > world.bestFitness) world.bestFitness = this.fitness();
		} else {
			this.life-= obj.energy;
			this.eaten--;
		}
		world.remove(obj);

	}
	this.life = Math.min(this.life, this.maxLife);
}

Nevo.prototype.processView = function(view) {
	if (view == null) {
		view = this.view;
	}

	var inputs = [];
	for (var i in this.view) {

		if (view[i] != null) {
			//var f = Math.max(0, 255-view[i].dist);
			/*
			var diff = Math.pow((this.color[0]-view[i].r)/25,2)+
					   Math.pow((this.color[1]-view[i].g)/25,2)+
					   Math.pow((this.color[2]-view[i].b)/25,2);
					   */
			//diff = this.color[0]-view[i].r;
			var f;
			if (view[i].dist > 300)
				f = 1;
			else {
				f = 300-view[i].dist;
				f/= 30;
				f = Math.pow(f, 2);
			}
			inputs.push(f * (view[i].r == 0 ? 1 : -1));
			inputs.push(view[i].r == 0 ? 10 : -10);
		} else {
			inputs.push(0);
			inputs.push(0);
		}

	}

	return inputs;
}

Nevo.prototype.update = function(objects) {
	this.age++;
	//this.life-= Math.pow(1.001, this.age/3);
	//this.life-= Math.sqrt(this.age)/30;
	this.life-= this.radius/5;
	//this.life-= 1;

	if (this.age%100 == 0) {
		this.radius+= 0.5;
	}


	if (this.age%6 == 0) {
		this.see(objects);

		var inputs = [];
		/*
		for(var i in this.memory) {
			var proc = this.processView(this.memory[i]);
			inputs = inputs.concat(proc);
		}
		*/
		inputs = inputs.concat(this.processView());
		inputs.push(this.linAcc/this.maxLinAcc);
		inputs.push(this.angAcc/this.maxAngAcc);
		inputs.push(this.life/this.maxLife);

		if (this.brain.getOutputs() != null && this.brain.getOutputs().length == 3) {
			//console.log(this.brain.getOutputs().length, this.brain.getOutputs());
			inputs = inputs.concat(this.brain.getOutputs());
		} else {
			inputs.push(0);
			inputs.push(0);
			inputs.push(0);
		}
		//console.log(inputs);
		this.brain.process(inputs);
	}

	//console.log(output);
	this.angAcc = this.maxAngAcc*this.brain.getOutputs()[0];

	this.linAcc = this.maxLinAcc*this.brain.getOutputs()[1];
	if(this.follow != null) {
		var delta = this.drift(this.follow);
		this.angAcc = delta;
		this.angAcc = this.angAcc > 0 ? Math.min(this.angAcc, this.maxAngAcc) : Math.max(this.angAcc, -this.maxAngAcc);
		this.linAcc = this.maxLinAcc*(Math.pow(3-2*Math.abs(delta/Math.PI), 2)/4.5-1);
	}

	this.linAcc = constrain(this.linAcc, this.maxLinAcc);
	this.linVel+= this.linAcc;
	this.linVel = constrain(this.linVel, this.maxLinVel);

	this.angAcc = constrain(this.angAcc, this.maxAngAcc);
	this.angVel+= this.angAcc;
	this.angVel = constrain(this.angVel, this.maxAngVel);

	this.rot = Angle.sum(this.angVel, this.rot);

	this.pos.x-= this.linVel*Math.sin(this.rot);
	this.pos.y+= this.linVel*Math.cos(this.rot);

	this.linAcc = this.angAcc = 0;
	this.linVel*= .96;
	this.angVel*= .8;

	if (this.age > 1000 && Math.random() < 10/this.age) {

		if (this.children.length == 0)
			Neuron.MUTATION_RATE = 1;
		else
			Neuron.MUTATION_RATE = 10;

		var child = this.reproduce(this);
		child.gen = this.gen;
		child.pos = this.pos.get();
		child.pos.x+= Math.random()*40-20;
		child.pos.y+= Math.random()*40-20;
		world.nevos.push(child);
		world.latticize([child]);
		if(this.gen.population.length>60)
			this.gen.population.pop(0);
		this.gen.population.push(child);
	}
}

Nevo.prototype.see = function(objects) {

	for (var i in this.view) {
		this.view[i] = null;
	}

	for(i in objects) {
		if(objects[i] == this)
			continue;

		var m = objects[i];
		var dist = this.pos.dist(m.pos);
		var rad = m.radius;
		if(dist < rad+this.radius) {
			this.eat(m);
			continue;
		}

		if(dist > 400)
			continue;

		var d = Angle.drift(this.pos, m.pos);

		var left = new Vec(m.pos.x+rad*Math.cos(d), m.pos.y+rad*Math.sin(d));
		var right = new Vec(m.pos.x-rad*Math.cos(d), m.pos.y-rad*Math.sin(d));
		left = this.drift(left);
		right = this.drift(right);

		if (right < -this.viewRange || left > this.viewRange)
			continue;

		left = Math.max(left, -this.viewRange);
		right = Math.min(right, this.viewRange);


		//console.log(Math.round(left/Math.PI*180)+" - "+Math.round(right/Math.PI*180));

		for(var j = left/Math.PI*180; j < right/Math.PI*180; j+= 1) {
			var k = parseInt(j);

			if (!(k in this.view))
				continue;

			if(this.view[k] != null && this.view[k].dist < dist)
				continue;

			this.view[k] = {
				'dist' : dist,
				'r': parseInt(Math.max(0, 255-dist/1.0)),//m.color[0],
				'g': 0,//Math.max(0, 255-dist/100.0),//m.color[1],
				'b': 0,//m.color[2],
				't': m.type
			}
		}

	}

	var view = {};
	for(var i in this.view)
		view[i] = this.view[i];
	this.memory.push(view);
	this.memory.shift();

}

Nevo.prototype.draw = function() {

	render.save();

	if(this.highlight != null)
		this.color = this.highlight;
	if(this.color == null)
		this.color = [
			Math.round(255-255*this.life/this.maxLife),
			Math.round(255*this.life/this.maxLife),
			0
		];

	var disc = this.linVel.x < 0;
	render.translate(this.pos.x, this.pos.y);


	render.font = '3pt monospace';
	render.fillStyle = '#fff';
	render.textAlign = 'center';
	if (showInfo) {
		render.fillText('A:'+parseInt(this.age), 0, -25);
		render.fillText('L:'+parseInt(this.life), 0, -20);
		render.fillText('F:'+this.fitness(), 0, -15);
		render.fillText('C:'+this.children.length, 0, -10);
	}

	render.rotate(this.rot+Math.PI/2);


	this.radius-= 1;
	render.beginPath();
	render.moveTo(this.radius*Math.cos(Math.PI/2.5*0),
				  this.radius*Math.sin(Math.PI/2.5*0));
	render.lineTo(this.radius*Math.cos(Math.PI/2.5*2),
				  this.radius*Math.sin(Math.PI/2.5*2));
	render.lineTo(this.radius*Math.cos(Math.PI/2.5*3),
				  this.radius*Math.sin(Math.PI/2.5*3));
	render.lineTo(this.radius*Math.cos(Math.PI/2.5*0),
				  this.radius*Math.sin(Math.PI/2.5*0));
	render.closePath();
	this.radius+= 1;

	render.strokeStyle = 'rgba('+this.color.join(',')+",0.8)";
	render.stroke();
	render.fillStyle = 'rgba('+this.color.join(',')+","+Math.pow(Math.cos(Math.pow(this.life/this.maxLife*Math.PI*1000, .4)*5), 2)+")";
	render.fill();

	render.beginPath();
	for(var i = 0; i < 5; i++) {
		render.lineTo(this.radius*Math.cos(Math.PI/2.5*i),
					  this.radius*Math.sin(Math.PI/2.5*i));
	}
	//render.arc(this.pos.x, this.pos.y, this.radius, 0, 2 * Math.PI, false);
	render.closePath();

	render.restore();


	if(this.follow != null) {
		render.moveTo(this.follow.x, this.follow.y);
		render.lineTo(this.pos.x, this.pos.y);
	}

	render.strokeStyle = 'rgba('+this.color.join(',')+",0.3)";
	render.stroke();
	render.fillStyle = 'rgba('+this.color.join(',')+",0.2)";
	render.fill();


	if(!fullDraw)
		return;
	for(i in this.view) {

		if (this.view[i] == null)
			continue;

		render.save();
		render.beginPath();
		render.moveTo(this.pos.x, this.pos.y);
		render.lineTo(
			this.pos.x+
			this.view[i].dist*Math.cos(this.rot+Math.PI/2+i/180*Math.PI),

			this.pos.y+
			this.view[i].dist*Math.sin(this.rot+Math.PI/2+i/180*Math.PI)
		);
		render.closePath();
		render.strokeStyle = 'rgba('+this.view[i].r+', '+this.view[i].g+', '+this.view[i].b+',1)';
		render.stroke();
		render.restore();
	}


}

Nevo.prototype.drift = function(vec) {
	var desired = Angle.drift(this.pos, vec);
	return Angle.sub(desired, this.rot);
}

Nevo.prototype.fitness = function() {
	return this.eaten;
	//return Math.pow(this.eaten, 1.0);
}

Nevo.prototype.reproduce = function(partner) {
	// The child brain is derived from the parent's ones
	var child = new Nevo(new Brain(this.brain, partner.brain, .04));
	child.color = this.color.slice();

	var c = parseInt(Math.random()*3);
	child.color[c] = parseInt(child.color[c]);
	child.color[c]+= parseInt(Math.random()*90-45);
	child.color[c] = Math.min(child.color[c], 255);
	child.color[c] = Math.max(child.color[c], 20);
	//console.log(child.highlight);

	child.setColor(child.color);
	child.addToTree(this.children);
	return child;
}

Nevo.prototype.setColor = function(c) {
	this.color = c;
	var agility = (255-this.color[0])/255*4;
	this.maxLinVel*= agility;
	this.maxLinAcc*= agility;
	this.maxAngVel*= agility;
	this.maxAngAcc*= agility;
}

Nevo.prototype.clone = function() {
	var child = new Nevo(this.brain.clone());
	child.setColor(this.color);
	child.addToTree(this.children);
	return child;
}
