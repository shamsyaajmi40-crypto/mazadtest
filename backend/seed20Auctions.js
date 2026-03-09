import mongoose from "mongoose"
import Auction from "../models/auction.model.js"

const users = [
"69ab1f2091763c63aa929937",
"69ab1fbb91763c63aa929a03",
"69ab22f091763c63aa929e97",
"69ade5d992e5f9f6e20f2650"
]

const images = [
"https://images.unsplash.com/photo-1555215695-3004980ad54c",
"https://images.unsplash.com/photo-1503376780353-7e6692767b70",
"https://images.unsplash.com/photo-1542362567-b07e54358753",
"https://images.unsplash.com/photo-1616788494672-ec7ca25d6b3d",
"https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6"
]

const governorates = [
"بغداد",
"البصرة",
"اربيل",
"كركوك",
"النجف",
"الموصل"
]

function rand(min,max){
return Math.floor(Math.random()*(max-min)+min)
}

function randFrom(arr){
return arr[Math.floor(Math.random()*arr.length)]
}

async function seed(){

const auctions=[]

for(let i=0;i<20;i++){

const seller=randFrom(users)

const start=new Date(Date.now()-rand(1,5)*3600000)

const end=new Date(Date.now()+rand(2,48)*3600000)

const startingPrice=rand(5000,20000)

const currentPrice=startingPrice+rand(500,5000)

auctions.push({

isDeleted:false,

seller,
owner:seller,

title:`Car Auction ${i+1}`,

description:"سيارة بحالة ممتازة",

isFeatured:false,
featuredUntil:null,
featuredPriority:0,

category:"CARS",

images:[randFrom(images)],

startingPrice,
currentPrice,

increment:rand(200,500),

startTime:start,
endTime:end,

status:"active",

depositAmount:3000,
sellerDeposit:3000,

auto:false,
penaltyApplied:false,

winner:Math.random()>0.7?randFrom(users):null,

governorate:randFrom(governorates),

winnerConfirmed:false,
sellerConfirmed:false,

deliveryMode:"manual",

settlementStatus:"pending",

closingLock:false,
closedAt:null,

bidCount:rand(0,25),

isDisputed:false,

createdAt:start,
updatedAt:new Date()

})

}

await Auction.insertMany(auctions)

console.log("✅ 20 Auctions Created")

process.exit()

}

seed()