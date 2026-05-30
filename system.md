I started an appliance repair business and have nothing but happy customers, a great business, good profits and low stress. AMA
A few people have asked me to do an AMA, so "here I am"!

Just a few bits of information to get you thinking:

I'm 65 now.

I automated nearly everything and have no employees, real, virtual, contract, outsourced. Nothing. No other humans.

I rarely answer the phone

I'm generally booked up solid 5 days a week and never work evenings or weekends or holidays.

Ask away!

~

HouseOfYards
•
4y ago
I automated nearly everything

How do you do that?


18
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
Most of is is described here although there is more.

When I purchase parts, the supplier emails a receipt. There is a custom app I wrote which parses the email and loads the parts and pricing into the products table in InvoiceNinja, which is what I use for customer billing.

InvoiceNinja is free if you host it yourself and has been very stable and "just right". It creates invoices which are emailed to the customer as well as handling online payments for those rare times when I don't collect COD.


23
u/HouseOfYards avatar
HouseOfYards
•
4y ago
parses the email and loads the part and pricing

This is interesting. We also made a custom app for a home service niche. One of the product features is accounting report. We just released it with expense report, and P&L (I'm a CPA by trade). In your app, each email format can be different, how does it get loaded properly into your product table?


3
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
how does it get loaded properly into your product table?

The invoices are columnar. It parses the various columns (part number, cost, list, quantity, etc.) and imports them using a MySQL stored procedure.

I wrote a custom importer for each vendor. Unfortunately they're all different. Fortunately I only use 2 main vendors most of the time and a few others "now and then" which I handle manually.

how does it get loaded properly into your product table?

The invoices are columnar. It parses the various columns (part number, cost, list, quantity, etc.) and imports them using a MySQL stored procedure.

I wrote a custom importer for each vendor. Unfortunately they're all different. Fortunately I only use 2 main vendors most of the time and a few others "now and then" which I handle manually.


2
u/HouseOfYards avatar
HouseOfYards
•
4y ago
2 main vendors

That certainly helps.


1
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
It helps in non-obvious ways too.

By being "something" to a couple of vendors instead of "nothing" to a whole bunch, I get good pricing and great service.

keninsd
•
4y ago
What's your automation suite of tools?


25
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
The public-facing side is Wordpress running the GeneratePress theme with a Linux/Apache/MySQL/PHP back end.

The home page is 100% custom code, which does a bunch of validation then lets the customer pick a day and time for their service call.

The back end is mostly MySQL and custom PHP code, which takes the service call that the customer entered and loads it on to my RoundCube calendar, along with links to Google Maps for driving directions and buttons for start/end call that populate the labor, and links to various supplier parts lookups based on the appliance brand.


38
rlocke
•
4y ago
At the risk of ruining your happiness, this sounds like a service people would pay for 😊


16
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
I'm pretty certain it is, but I have no desire to get back into the software business, so y'all will have to roll your own.

I'm always happy to answer technical questions, so feel free to ask.

21

You are a scholar and a gentleman. I’m actually in the software biz myself but lurking on this sub for ideas post tech career. Unfortunately I don’t have much in the way of other skills haha.


12
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
FWIW, appliances are just like software, only made with physical parts. I know it sounds ridiculous, but they aren't all that different.

Also, unlike software, which is never finished, appliances either work or not. If you fix them they work.

Nobody comes back and says "Thanks for fixing my microwave last month, can you make it dispense smoothies now?"

This is much less stress.

What appliances do you repair? Do people tend to opt to repair even if the cost of the repair likely exceeds the value of the item? How much do you charge? Did you find your background I'm SWE better prepared you for your current work?


12
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
Great questions!

What appliances do you repair?

Refrigerators, freezers, washers, dryers, stoves, cooktops and wall ovens. No microwaves or garbage disposals because the repair cost nearly always exceeds the replacement cost.

Do people tend to opt to repair even if the cost of the repair likely exceeds the value of the item?

Nope. They'll typically go up to almost half. After that they usually won't do it, but more importantly, I won't do the repair. I never want the customer to think "I just spent $1500 to fix this $2000 refrigerator and it only lasted 2 years"

How much do you charge?

The initial service call is $110, which covers up to the first half hour in the home, including diagnosis and possibly some portion of the repair if they want to fix it.

Did you find your background I'm SWE better prepared you for your current work?

While the coding skills are definitely useful, what really helped was having knowledge of how a well run business works. Several of my previous employers were managed spectacularly, which has been an immeasurable help in running my business.

start edit

To go along with the above, several of my employers were terrible at business. One left a trail of angry customers decades long that finally ended up in bankruptcy, and another oversold his capabilities and ended up skipping town in the middle of the night.

They were examples of "what not to do".

end edit

I handle problems in two steps:

Make the customer happy, no matter what.

Change my business process so it becomes impossible for the problem to ever happen again, so whatever the problem was, is something I never need to address a second time.

IWTLEverything
•
4y ago
How did you get your initial customers? How do you acquire customers today? Do you go to them or do they bring things to you? Any licensing required?


9
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
How did you get your initial customers? How do you acquire customers today? Do you go to them or do they bring things to you? Any licensing required?

My very first half dozen customer were referrals from family and friends.

After that I set a $300/month budget for google ads targeted at my zipcode and a few nearby.

Now they're all referrals and Google search results, and I don't do any paid advertising.


25
feraxil
•
3y ago
This astonishes me. I pay ridiculous amounts of $ for ads and barely stay as busy as I need.

2
Majestic-Birthday-66
•
2y ago
If you are licensed and insured, you can work as a service provider for extended warranty companies.


1
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
2y ago
I have absolutely no desire to do any warranty work for anybody, extended or not

drsmith48170
•
4y ago
Ok an obvious question - how did you learn to repair appliances? Do you have to subscribe or get certified by manufacturers?? Do you just use the manufacturer resources to diagnose and repair the appliances???


16

TerrysApplianceSvc
OP
•
4y ago
[deleted]
•
4y ago
He's a software engineer, so google/stackoverflow


14
IWTLEverything
•
4y ago
So he just copies and pastes other peoples repairs? /s

18

1 more reply
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
Actually YouTube is sort of good, although a lot of the guys are not wizards and half the time they're wrong and are doing the equivalent of an oil change by drilling a hole through the fender and oil pan instead of jacking up the car and removing the plug.

If you can tell BS from real, it's pretty good.

I pay for access to service information directly from the manufacturer for my biggest brands and get the rest in a few other places.


6
After-Cell
•
4y ago
"I pay directly to the manufacturer" Would that be the appliantology.org site?

I need a service manual for a Daikin FTKA50AV1H to get the part number for the mainboard


3
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
A little googling turned up nothing for Daikin parts, so that would go into the "sorry, I can't help you" bucket.

Inevitable-Repair649
•
2y ago
How would I go about paying for service information directly from the manufacturer?


1
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
2y ago
For GE, you sign up for their "smarthqservice" tool and website. It's about $70/month, but TBH, I cancelled mine.

Most of the rest, you need to "pay for it" in the form of doing warranty service.

You can get lot of information by joining appliantology.org.

Also, if you get really good at Google, there is a lot of info you can dig up for free.

[deleted]
•
4y ago
Thanks!!! Is it more of a hassle working with electronic heavy appliances? For instance, when I needed to buy a new clothes washer I went with an analog Speed Queen instead of something digital with a motherboard.


4
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
Thanks!!! Is it more of a hassle working with electronic heavy appliances? For instance, when I needed to buy a new clothes washer I went with an analog Speed Queen instead of something digital with a motherboard.

The electronic models are generally easier to work on because the boards contain diagnostic software. If you know how to access the diagnostics, they will often tell you what's wrong.

OTOH, the mechanical models were simpler and more reliable.

OTOOH, some machines like Samsung refrigerators have problems that are not what they present as and aren't reliably fixable because they're actually design and engineering defects.

What sorts of parts do you carry with you? Or do you just diagnose and order what’s needed?


2
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
What sorts of parts do you carry with you? Or do you just diagnose and order what’s needed?

Inventory is a huge part of success.

If I don't have a part I need, it requires a return trip later in the week and makes the customer angry and makes me lose money because I only charge the "trip charge" once, so stocking all possible parts improves profits and efficiency and customer happiness.

However parts are expensive, occupy space, and also "expire", so I need to balance space, capital, time and driving costs so I don't get stuck with parts that won't sell in a reasonable time, while minimizing wasted time for return trips with ordered parts.

Expensive uncommon parts get ordered as needed. There's a Whirlpool wall oven that takes a control panel that's about $2000. I don't think any service agencies stock it.

How much do you make a year?


2
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
I'm not giving out actual numbers, but I make more than I did as a Sr. Software Engineer, with less than half the hours and about 10% of the stress and no nights or weekends.

Also I get as many "vacation days" as I feel like, whenever I want.


nateture
•
4y ago
Do you think it’s worth it to pay for some kind of schooling/training course? If so, is there one in particular you would recommend? I saw the Master Samurai Tech courses on the website you mentioned Appliantology and they range from $700-$1300.


2
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
MST is absolutely worth it, as is the appliantology.org website when you're done with the classes.

4

1 more reply
u/unclezaza avatar
unclezaza
•
4y ago
How do you automate scheduling? I see the part about invoicing, but not about how you calendar each visit. Do you estimate per type of job, or just schedule everyone for a specific slot (1-2 hrs)?


2
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
I limit the area size so I can get from any part of it to any other part of it in 15-20 minutes or less.

I do have the actual time-of-day drive time information available between locations via Google's time and distance matrix API; however, it seems like diminishing returns for a lot of extra complexity.

Did you pay for an existing business's clientele or literally start from scratch? If the latter, what would you attribute your success to compared to all the other appliance shops out there? And I'm also curious as to whether you're operating under your own brand name or a logo/franchise.


1
u/TerrysApplianceSvc avatar
TerrysApplianceSvc
OP
•
4y ago
Did you pay for an existing business's clientele or literally start from scratch?

I started 100% from scratch.

If the latter, what would you attribute your success to compared to all the other appliance shops out there?

What make me different is not a secret and I'll happily share it because almost nobody will do it:

I am 100% focused on customer happiness. This isn't just lip service. I'll do nearly anything to make a customer happy and make their appliance work correctly. If they need something I can't/won't do, I'll refer them to someone I know is excellent or if I don't know anybody excellent, I'll refer them back to the manufacturer.

I know my limits. I don't try to be half-assed electrician or half-assed plumber or anything else. If they need plumbing or electrical, I refer them.

I only work on things that can be 100% repaired correctly. This means if you have a Samsung or LG refrigerator, I'm not your guy.

I'm also curious as to whether you're operating under your own brand name or a logo/franchise.

My name. It's Terry's Appliance Service and I'm Terry.
