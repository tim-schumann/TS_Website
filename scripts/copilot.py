# function to create random 9-digit numbers

import random

def numgen():
    copilot = random.randint(100000000, 999999999)
    return copilot

print(numgen())

# create a funtion to check if the number is prime

def is_prime(num):
    if num > 1:
        for i in range(2, num):
            if (num % i) == 0:
                print(num, "is not a prime number")
                break
        else:
            print(num, "is a prime number")
    else:
        print(num, "is not a prime number")

is_prime(numgen())