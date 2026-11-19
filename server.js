const express=require('express'),http=require('http'),{Server}=require('socket.io'),crypto=require('crypto');
const app=express(),server=http.createServer(app),io=new Server(server,{cors:{origin:false}});app.use(express.static('public'));
const qs=[
['Какова формула плотности?',['ρ = m/V','ρ = m·V','ρ = V/m','ρ = m+V'],0,'Плотность — отношение массы к объёму.'],
['Единица плотности в СИ?',['кг','м³','кг/м³','Н'],2,'В СИ плотность измеряют в кг/м³.'],
['Масса 200 г, объём 100 см³. Плотность?',['2 г/см³','20 г/см³','0,5 г/см³','200 г/см³'],0,'200 / 100 = 2 г/см³.'],
['Что нужно измерить для определения плотности тела?',['Силу и время','Массу и объём','Температуру и путь','Скорость и время'],1,'Нужны масса и объём.'],
['Объём 5 см³, плотность 8 г/см³. Масса?',['13 г','1,6 г','40 г','3 г'],2,'m = ρV = 8 · 5 = 40 г.'],
['Масса 600 г, плотность 3 г/см³. Объём?',['1800 см³','200 см³','603 см³','2 см³'],1,'V = m/ρ = 600/3 = 200 см³.'],
['Почему масло обычно плавает на воде?',['Оно тяжелее','Его плотность меньше плотности воды','Оно холоднее','У него нет массы'],1,'Масло менее плотное и не смешивается с водой.'],
['Плотность воды примерно равна…',['1000 кг/м³','10 кг/м³','100 кг/м³','10 000 кг/м³'],0,'1000 кг/м³ = 1 г/см³.'],
['Два одинаковых по объёму кубика: железный и деревянный. Какой обычно тяжелее?',['Деревянный','Одинаковые','Железный','Нельзя сравнить'],2,'При равном объёме больше масса у более плотного вещества.'],
['Как найти объём камня неправильной формы?',['По цвету','По вытесненной воде в мензурке','По температуре','По весам без воды'],1,'Разность уровней воды показывает объём погружённого камня.'],
['Плотность 2 г/см³ — это…',['200 кг/м³','2000 кг/м³','20 кг/м³','20 000 кг/м³'],1,'1 г/см³ = 1000 кг/м³.'],
['Одинаковая масса: у какого тела объём больше?',['У более плотного','У менее плотного','Всегда одинаков','Зависит только от цвета'],1,'V = m/ρ: при меньшей плотности объём больше.']
].map((x,i)=>({id:i,text:x[0],options:x[1],correct:x[2],why:x[3],round:Math.floor(i/4)+1}));
const colors=['red','blue','green','yellow'];const rooms=new Map();function code(){return crypto.randomBytes(3).toString('hex').toUpperCase()};function clean(s,max=24){return String(s||'').trim().replace(/[<>]/g,'').slice(0,max)}
function state(r,teacher=false){return {code:r.code,phase:r.phase,index:r.index,total:qs.length,round:Math.min(3,Math.floor(Math.max(r.index,0)/4)+1),deadline:r.deadline,teams:colors.map(c=>({color:c,players:[...r.players.values()].filter(p=>p.team===c).map(p=>({name:p.name,score:p.score,answered:r.answers.has(p.id)})),score:[...r.players.values()].filter(p=>p.team===c).reduce((s,p)=>s+p.score,0)})),question:r.index>=0?{id:r.index,text:qs[r.index].text,options:qs[r.index].options}:null,reveal:r.phase==='reveal'?{correct:qs[r.index].correct,why:qs[r.index].why}:null,teacher};}
function broadcast(r){io.to(r.code).emit('state',state(r));}
function advance(r){clearTimeout(r.timer);if(r.index>=qs.length-1){r.phase='done';r.deadline=null;}else{r.index++;r.phase='question';r.answers=new Set();r.deadline=Date.now()+30000;r.timer=setTimeout(()=>reveal(r),30000)}broadcast(r)}

function reveal(r){
  if(r.phase!=='question')return;
  clearTimeout(r.timer);
  r.phase='reveal';
  r.deadline=null;
  broadcast(r);
  r.timer=setTimeout(()=>advance(r),5000);
}
 io.on('connection',s=>{
s.on('create',(_,cb)=>{let c=code();while(rooms.has(c))c=code();const token=crypto.randomBytes(24).toString('hex');const r={code:c,token,players:new Map(),phase:'lobby',index:-1,answers:new Set(),deadline:null,timer:null};rooms.set(c,r);s.join(c);s.data={code:c,teacher:true};cb({ok:true,code:c,token,state:state(r,true)});});
 s.on('teacherJoin',({code:c,token},cb)=>{const r=rooms.get(clean(c,8).toUpperCase());if(!r||r.token!==token)return cb({error:'Комната или ключ учителя неверны'});s.join(r.code);s.data={code:r.code,teacher:true};cb({ok:true,state:state(r,true)});});
 s.on('join',({code:c,name,team,playerId},cb)=>{const r=rooms.get(clean(c,8).toUpperCase()),n=clean(name);if(!r)return cb({error:'Комната не найдена'});if(!n||!colors.includes(team))return cb({error:'Введите имя и выберите команду'});if(r.phase!=='lobby'&&!r.players.has(playerId))return cb({error:'Игра уже началась'});let p=r.players.get(playerId);if(!p){if([...r.players.values()].filter(p=>p.team===team).length>=7)return cb({error:'В команде уже 7 участников'});if([...r.players.values()].some(p=>p.team===team&&p.name.toLowerCase()===n.toLowerCase()))return cb({error:'Это имя уже занято в команде'});playerId=crypto.randomUUID();p={id:playerId,name:n,team,score:0};r.players.set(playerId,p)}s.join(r.code);s.data={code:r.code,playerId};cb({ok:true,playerId,state:state(r)});broadcast(r)});
 s.on('answer',({choice},cb)=>{const r=rooms.get(s.data?.code),p=r?.players.get(s.data?.playerId);if(!r||!p||r.phase!=='question'||r.answers.has(p.id)||Date.now()>r.deadline)return cb?.({error:'Ответ уже принят или время вышло'});if(!Number.isInteger(choice)||choice<0||choice>3)return cb?.({error:'Неверный вариант'});r.answers.add(p.id);const correct=choice===qs[r.index].correct;if(correct)p.score+=2;cb?.({ok:true,correct,points:correct?2:0});broadcast(r);});
 s.on('control',({action},cb)=>{const r=rooms.get(s.data?.code);if(!r||!s.data.teacher)return cb?.({error:'Нет прав учителя'});if(action==='start'&&r.phase==='lobby'){if(!r.players.size)return cb?.({error:'Сначала добавьте учеников'});advance(r)}else if(action==='reveal')reveal(r);else if(action==='next'&&r.phase==='reveal')advance(r);else if(action==='reset'){clearTimeout(r.timer);r.phase='lobby';r.index=-1;r.deadline=null;r.answers=new Set();for(const p of r.players.values())p.score=0;broadcast(r)}else return cb?.({error:'Действие сейчас недоступно'});cb?.({ok:true});});
});
app.get('/health',(req,res)=>res.json({ok:true,rooms:rooms.size}));server.listen(process.env.PORT||3000,()=>console.log('Density Battle ready'));
