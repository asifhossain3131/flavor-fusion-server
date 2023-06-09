const express=require('express')
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt=require('jsonwebtoken')
const SSLCommerzPayment = require('sslcommerz-lts')
const moment=require('moment')
const nodemailer=require('nodemailer')

const port=process.env.PORT||5000;
const app=express()

const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASS
const is_live = false


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


const sendEmail=(emailMessage, emailAddress)=>{
 const transporter=nodemailer.createTransport({
  service:'gmail',
  auth:{
    user:process.env.EMAIL,
    pass:process.env.EMAIL_PASS
  }
 })
 transporter.verify(function(error,success){
  if(error){
    console.log(error)
  }
  else{console.log('server is ready to take email')}
 })
 const mailOptions={
  from: process.env.EMAIL,
  to:emailAddress,
  subject:emailMessage?.subject,
  html:`<p>${emailMessage.body}</p>`
 }
 transporter.sendMail(mailOptions, function (error, info) {
  if (error) {
    console.log(error)
  } else {
    console.log('Email sent: ' + info.response)
  }
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
    // await client.connect();
    const categoryCollections=client.db('flavorFusion').collection('category')
    const menuCollections=client.db('flavorFusion').collection('menu')
    const customerReviewCollections=client.db('flavorFusion').collection('customerReview')
    const cartCollections=client.db('flavorFusion').collection('cart')
    const categoryDetailCollections=client.db('flavorFusion').collection('categoryDetail')
    const userCollecations=client.db('flavorFusion').collection('users')
    const paymentCollectons=client.db('flavorFusion').collection('payment')
    const deliveredCollections=client.db('flavorFusion').collection('delivered')
    const latestNewsCollections=client.db('flavorFusion').collection('latestNews')
    const reservationCollections=client.db('flavorFusion').collection('reservations')
     
    
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
      price:newUpdate.price

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

// payment related 
app.get('/orderedFoods', verifyToken,verifyAdmin, async(req,res)=>{
  const result=await paymentCollectons.find().toArray()
  res.send(result)
})

app.get('/orderedFood/:transId',async(req,res)=>{
  const result=await paymentCollectons.findOne({transId:req.params.transId})
  res.send(result)
})

app.post('/order/:email',verifyToken, async(req,res)=>{
  const email=req.params.email
  const matchedCart=await cartCollections.findOne({user:email})
  const orderedProducts=matchedCart?.items
  const foods=orderedProducts.map(food=>food.name)
  const total=orderedProducts.reduce((sum,price)=>price.total+sum,0)
  const transId=new ObjectId().toString()

  const data = {
    total_amount: total,
    currency: 'BDT',
    tran_id: transId, // use unique tran_id for each api call
    success_url: `http://localhost:5000/orderCompleted/${transId}?email=${email}`,
    fail_url: 'http://localhost:3030/fail',
    cancel_url: 'http://localhost:3030/cancel',
    ipn_url: 'http://localhost:3030/ipn',
    shipping_method: 'Courier',
    product_name: 'alu',
    product_category: 'Electronic',
    product_profile: 'general',
    cus_name: 'Customer Name',
    cus_email: email,
    cus_add1: 'Dhaka',
    cus_add2: 'Dhaka',
    cus_city: 'Dhaka',
    cus_state: 'Dhaka',
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    cus_phone: '01711111111',
    cus_fax: '01711111111',
    ship_name: 'Customer Name',
    ship_add1: 'Dhaka',
    ship_add2: 'Dhaka',
    ship_city: 'Dhaka',
    ship_state: 'Dhaka',
    ship_postcode: 1000,
    ship_country: 'Bangladesh',
};
const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
sslcz.init(data).then(apiResponse => {
    // Redirect the user to payment gateway
    let GatewayPageURL = apiResponse.GatewayPageURL
    res.send({url:GatewayPageURL})
  });

  const finalOrder={
    email,orderedProducts,transId,status:'pending',date:moment().format('LLL')
  }
  const result=await paymentCollectons.insertOne(finalOrder)
})

app.post('/orderCompleted/:transId',async(req,res)=>{
  const transId=req.params.transId
  const email=req.query.email
   const updatedStatus=await paymentCollectons.updateOne({transId:transId},{
    $set:{
      status:'Completed'
    }
   },{upsert:true})
   if(updatedStatus.modifiedCount>0){
    const cartItems=await cartCollections.findOne({user:email})
    const result=await cartCollections.deleteOne(cartItems)
    sendEmail({
      subject:'Your food ordered has been placed sucessfully',
      body:`Transaction ID ${transId} placed successfully. Hope you will get your parcel very shortly`
    }, email)
    sendEmail({
      subject:'New Food has been placed',
      body:`Transaction ID ${transId} ordered foods. Please check the list to deliver the parcel shortly`
    }, 'changemakers789@gmail.com')
    res.redirect(`http://localhost:5173/dashboard/paymentSuccess/${transId}`)
   }

})

// deliverd food related 
app.get('/deliveredFood',async(req,res)=>{
  const result=await deliveredCollections.find().toArray()
  res.send(result)
})

app.get('/deliveredFood/:email',verifyToken, async(req,res)=>{
  const email=req.params.email
  const result=await deliveredCollections.find({email:email}).toArray()
  res.send(result)
})

app.post('/deliveredFood/:transId',verifyToken,verifyAdmin, async(req,res)=>{
  const transId=req.params.transId
  const updatedStatus=await paymentCollectons.updateOne({transId:transId},{
    $set:{
      status:'delivered'
    }
  },{upsert:true})
  if(updatedStatus.modifiedCount>0){
    const target=await paymentCollectons.findOne({transId:transId})
    const newDelivered=await deliveredCollections.insertOne(target)
    if(newDelivered.acknowledged===true){
      const result=await paymentCollectons.deleteOne({transId:transId})
      res.send(result)
    }
  }
})

// latest news related 
app.get('/latestnews', async(req,res)=>{
  const id=req.query.id
  let result
  if(id){
   result= await latestNewsCollections.findOne({_id:new ObjectId(id)})
  }
  else{
    result= await latestNewsCollections.find().toArray()
  }
  res.send(result)
})

// reservation related 
app.post('/reservations',verifyToken, async(req,res)=>{
  const reservationInfo=req.body
  const result=await reservationCollections.insertOne(reservationInfo)
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