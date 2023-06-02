const express=require('express')
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt=require('jsonwebtoken')


const port=process.env.PORT||5000;
const app=express()

// middleware
app.use(cors())
app.use(express.json())

const verifyToken=(req,res,next)=>{
  const authorization=req.headers.authorization
  if(!authorization){
    return res.status(401).send({error:true, message:'unauthorized access'})
  }
  const token=authorization.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN, (err,decoded)=>{
    if(err){
      return res.status(401).send({error:true, message:'token expired'})
    }
    req.decoded=decoded
    next()
  })
}



const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_KEY}@cluster0.df7drrh.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const categoryCollections=client.db('flavorFusion').collection('category')
    const menuCollections=client.db('flavorFusion').collection('menu')
    const customerReviewCollections=client.db('flavorFusion').collection('customerReview')
    const cartCollections=client.db('flavorFusion').collection('cart')
    const categoryDetailCollections=client.db('flavorFusion').collection('categoryDetail')
    const userCollecations=client.db('flavorFusion').collection('users')
     
    
    // jwt related 
    app.post('/jwt',(req,res)=>{
      const user=req.body
      const token=jwt.sign(user,process.env.ACCESS_TOKEN,{expiresIn:'2h'})
      res.send({token})
    })

    const verifyAdmin=async (req,res,next)=>{
      const email=req.decoded.email
      const filter={email:email}
      const user=await userCollecations.findOne(filter)
      if(user?.role!=='admin'){
        return res.status(403).send({error:true, message:'forbidden access'})
      }
      next()
    }

//  category related 
app.get('/categories',async(req,res)=>{
    const result=await categoryCollections.find().toArray()
    res.send(result)
})

app.get('/popularDishes',async(req,res)=>{
    const query={isPopular: true}
    const result=await menuCollections.find(query).limit(6).toArray()
    res.send(result)
})

// menu related 
app.get('/menus',async(req,res)=>{
  const limit=parseInt(req.query.limit )
  const currentPage=parseInt(req.query.currentPage)
  const skip=limit*currentPage
  const result=await menuCollections.find().skip(skip).limit(limit).toArray()
  res.send(result)
})

app.get('/menu/:id', async(req,res)=>{
  const id=req.params.id
  const filter={_id:new ObjectId(id)}
  const result=await menuCollections.findOne(filter)
  res.send(result)
})

app.get('/menus/:categoryName', async(req,res)=>{
  const categoryName=req.params.categoryName
  const filter={category:categoryName}
  const result=await menuCollections.find(filter).toArray()
  res.send(result)
})

app.get('/countMenus', async(req,res)=>{
 const totalFoods=await menuCollections.countDocuments()
 res.send({totalFoods})
})

app.post('/menus',async(req,res)=>{
  const newMenus=req.body
  const result=await menuCollections.insertOne(newMenus)
  res.send(result)
})

app.put('/menu/:id',async(req,res)=>{
  const newUpdate=req.body
  const id=req.params.id
  const filter={_id: new ObjectId(id)}
  const options={upsert:true}
  const updatedFood={
    $set:{

    }
  }
  const result=await menuCollections.updateOne(filter,updatedFood,options)
  res.send(result)
})

app.delete('/menu/:id',verifyToken,verifyAdmin, async(req,res)=>{
  const id=req.params.id
  const filter={_id:new ObjectId(id)}
  const result=await menuCollections.deleteOne(filter)
  res.send(result)
})

// user related 
app.get('/users',verifyToken, verifyAdmin, async(req,res)=>{
  const result=await userCollecations.find().toArray()
  res.send(result)
})

app.get('/users/admin/:email', verifyToken, async(req,res)=>{
  const email=req.params.email
  const filter={email: email}
  const user=await userCollecations.findOne(filter)
  if(req.decoded.email!==email){
    return res.send({admin:false})
  }
  const result={admin: user?.role==='admin'}
  res.send(result)
})

app.post('/users',async(req,res)=>{
  const user=req.body
  const filter={email:user.email}
  const existUser=await userCollecations.findOne(filter)
  if(existUser){
    return res.send('User already exists')
  }
  const result=await userCollecations.insertOne(user)
  res.send(result)
})

app.patch('/user/:id',async(req,res)=>{
  const filter={_id:new ObjectId(req.params.id)}
  const updateUser={
    $set:{
      role:'admin'
    }
  }
  const result=await userCollecations.updateOne(filter,updateUser)
  res.send(result)
})

app.delete('/user/:id',async(req,res)=>{
  const filter={_id:new ObjectId(req.params.id)}
  const result=await userCollecations.deleteOne(filter)
  res.send(result)
})


// customer reviews related 
app.get('/reviews', async(req,res)=>{
  const result=await customerReviewCollections.find().toArray()
  res.send(result)
})

// cart related 
app.get('/cart',verifyToken, async(req,res)=>{
  const email=req?.query?.email

  if(!email){
   res.send([])
  }

  if(req.decoded.email!==email){
    return res.status(403).send('forbidden access')
  }
  
  const query={user:email}
  const result=await cartCollections.find(query).toArray()
  res.send(result)
})

app.post('/cart', async(req,res)=>{
  const user=req.query.email
  const name=req.query.name
  const price=parseFloat(req.query.price)
  const quantity=parseInt(req.query.quantity)
  const total=price*quantity
   
  const cart=await cartCollections.findOne({user})
  if(cart){
  const updatedFood=cart.items.map(food=>{
    if(food.name===name){
      food.quantity+=quantity
      food.total+=total
    }
    return food
  })
  const existFood=updatedFood.find(food=>food.name===name)
  if(existFood){
    await cartCollections.updateOne({user}, {$set: {items: updatedFood}})
  }
  else{
 await cartCollections.updateOne({user}, {$push:{items:{name,total,quantity}}})
  }
  }
  else{
    const newCart={
      user,
      items:[{name,total,quantity}]
    }
    await cartCollections.insertOne(newCart)
  }
   
 res.send({message:'successful'})
})


// category detail related 
app.get('/categoryDetail',async(req,res)=>{
  const category=req.query.category
  const filter={categoryName: category}
  const result=await categoryDetailCollections.findOne(filter)
  res.send(result)
})


 // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('kitchen is running now')
})


app.listen(port)