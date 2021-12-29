#define C4WA_MM_FIXED
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "life-inf.h"

extern void init () {
#ifdef C4WA
    mm_init(RESERVED_REGION, max(sizeof(struct Box0), sizeof(struct Box)));
#endif

    char * initial_pos = "........."
                         ".....x..."
                         "...xxx..."
                         "....x...."
                         ".........";
    const int sX = 9;
    const int sY = 5;
    assert(sX * sY == strlen(initial_pos));

    read_from_region(0, 0, sX, sY, initial_pos);

    struct Stat stat_i;
    life_prepare(&stat_i);

    int iter;
    unsigned int hash[4];
    hash[3] = stat_i.hash;
    for (iter = 0; iter < 1000; iter ++) {
        life_step(iter + 1, &stat_i);
        int j;
        for(j = 0; j < 4 && hash[j] != stat_i.hash; j ++);
        if (j < 4) {
            printf("Cycle detected at iter = %d\n", iter);
            break;
        }
        for(j = 0; j < 4; j ++)
            hash[j] = j < 3? hash[j+1]: stat_i.hash;
    }

    printf("Successfully completed %d iterations: cnt = %d\n", iter, stat_i.count);
}

#ifndef C4WA
int main () {
    init();
    return 0;
}
#endif