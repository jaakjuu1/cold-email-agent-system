# Objection Handling Reply Template

## Template ID: response_objection_v1

### Purpose
Handle common objections professionally and attempt to re-engage.

### Common Objections

---

## "Not Interested"

```
Subject Line: Re: {original_subject}

{acknowledge_response}

{clarifying_question}

{value_reminder}

{signature}
```

### Example

```json
{
  "first_name": "Sarah",
  "original_subject": "Quick question about TechCorp's expansion",
  "acknowledge_response": "Appreciate you letting me know, Sarah – definitely don't want to waste your time.",
  "clarifying_question": "Out of curiosity, is it more that the timing isn't right, or that developer productivity isn't a priority for TechCorp this year?",
  "value_reminder": "Either way, happy to stay in touch if things change down the road.",
  "signature": "Best,\nJohn"
}
```

---

## "Bad Timing / Too Busy"

```json
{
  "first_name": "Sarah",
  "original_subject": "Quick question about TechCorp's expansion",
  "acknowledge_response": "Completely understand, Sarah – timing is everything.",
  "clarifying_question": "Would it make sense for me to reach back out in Q2, or is there a better time to reconnect?",
  "value_reminder": "In the meantime, happy to send over any resources that might be helpful when you're ready to explore this.",
  "signature": "Best,\nJohn"
}
```

---

## "Already Have a Solution"

```json
{
  "first_name": "Sarah",
  "original_subject": "Quick question about TechCorp's expansion",
  "acknowledge_response": "Good to know you're already addressing this, Sarah.",
  "clarifying_question": "Curious – how are you finding your current setup? Most teams I talk to are always looking to improve, even if they have something in place.",
  "value_reminder": "Not trying to replace what's working, but happy to share how others have complemented their existing tools if that's ever helpful.",
  "signature": "Best,\nJohn"
}
```

---

## "Send Me More Info"

```json
{
  "first_name": "Sarah",
  "original_subject": "Quick question about TechCorp's expansion",
  "acknowledge_response": "Absolutely! Here's what I think would be most relevant for TechCorp:",
  "resources": "1. [One-pager on our approach]\n2. [Case study from similar company]\n3. [2-minute product overview video]",
  "next_step": "Once you've had a chance to look through these, would a brief call make sense to discuss your specific situation?",
  "signature": "Let me know if you have any questions!\nJohn"
}
```

---

## "Talk to [Someone Else]"

```json
{
  "first_name": "Sarah",
  "original_subject": "Quick question about TechCorp's expansion",
  "acknowledge_response": "Thanks for pointing me in the right direction, Sarah!",
  "request_intro": "Would you mind making a quick intro to {referred_person}? Always helps to come in warm rather than cold.",
  "alternative": "If it's easier, I can reach out directly and mention you suggested we connect.",
  "signature": "Really appreciate the help!\nJohn"
}
```

### Key Principles
- Never argue or get defensive
- Ask clarifying questions
- Respect their decision
- Leave the door open
- Provide value even if they say no
- Get specific feedback when possible

