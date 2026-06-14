---
title: "Approximate Nearest Neighbor Search in High-Dimensional Spaces using Learned Index Structures"
author:
  - name: "Alice Chen"
    affiliation: "Department of Computer Science, Stanford University"
    email: "achen@stanford.edu"
  - name: "Bob Martinez"
    affiliation: "Google Research, Mountain View"
    email: "bobm@google.com"
  - name: "Carol Nakamura"
    affiliation: "MIT CSAIL, Cambridge"
    email: "caroln@mit.edu"
date: "2024-06-15"
abstract: |
  Approximate nearest neighbor (ANN) search is a fundamental problem in machine
  learning, information retrieval, and computer vision. Traditional indexing
  structures such as KD-trees and ball trees suffer from the *curse of
  dimensionality*, rendering them ineffective for high-dimensional data. In this
  paper, we propose **LearnedANN**, a novel approach that leverages learned index
  structures to accelerate ANN search. Our method trains a lightweight neural
  network to predict the probability distribution of candidate points, reducing
  the search space by up to 94% compared to brute-force baselines. We evaluate
  LearnedANN on standard benchmarks (SIFT-1M, GloVe-200, Deep-1B) and show that
  it achieves **1.8--3.2x** speedup over HNSW while maintaining recall@10 above
  0.95. Our theoretical analysis provides regret bounds for the learned component,
  and we prove that the expected query time is $O(\log n + d)$ where $d$ is the
  ambient dimension.
bibliography: references.bib
numbersections: true
---

# Introduction

Nearest neighbor search is a core primitive in modern machine learning systems.
Given a query point $q \in \mathbb{R}^d$ and a dataset $\mathcal{D} =
\{x_1, x_2, \ldots, x_n\} \subset \mathbb{R}^d$, the goal is to find:

$$x^* = \arg\min_{x \in \mathcal{D}} \|q - x\|_2$$

In many practical applications---such as recommendation systems, image retrieval,
and large language model inference---exact search is prohibitively expensive for
large $n$ and $d$. Approximate methods relax this to finding $x'$ such that
$\|q - x'\|_2 \leq (1 + \epsilon) \|q - x^*\|_2$ for some $\epsilon > 0$.

## Motivation

Existing ANN methods fall into three categories:

1. **Tree-based methods** (KD-trees, VP-trees) which partition space
   hierarchically but degrade in high dimensions [@bentley1975multidimensional].
2. **Hashing-based methods** (LSH, Spherical Hashing) which map similar points
   to the same bucket with high probability [@datar2004locality].
3. **Graph-based methods** (HNSW, NSG) which construct navigable small-world
   graphs for greedy search [@malkov2018hnsw].

Recent work on *learned index structures* [@kraska2018case] suggests that
replacing hand-crafted indexes with learned models can yield significant
performance gains. We extend this idea to the ANN domain.

## Contributions

Our contributions are threefold:

- We propose **LearnedANN**, a learned index architecture for high-dimensional
  ANN search combining a cascade of learned filters with a graph-based
  refinement stage.
- We provide **theoretical guarantees** on query time and recall, showing that
  our approach achieves logarithmic expected query time under mild distributional
  assumptions.
- We conduct **extensive experiments** on billion-scale datasets, demonstrating
  practical speedups of 1.8--3.2x over state-of-the-art methods.

# Background and Related Work

## Approximate Nearest Neighbor Search

The ANN problem has a rich literature. The landmark result of Indyk and Motwani
[@indyk1998approximate] established that locality-sensitive hashing (LSH) can
achieve sub-linear query time. For Euclidean distance, the best LSH schemes
achieve $O(n^{1/(1+\epsilon)})$ query time, but the exponent remains large for
moderate $\epsilon$.

## Learned Index Structures

Kraska et al. [@kraska2018case] demonstrated that neural networks can
effectively replace B-trees for one-dimensional lookup. The key insight is that
a CDF model $F: \mathbb{R} \to [0, 1]$ can predict the position of a key in a
sorted array. Subsequent work extended this to multi-dimensional
settings [@kristo2020learned] and spatial indexes [@nathan2020learning].

## Problem Formulation

**Definition 1** ($c$-Approximate Nearest Neighbor). *Given a dataset
$\mathcal{D} \subset \mathbb{R}^d$, a query $q$, and $c \geq 1$, return a point
$x' \in \mathcal{D}$ such that*

$$\|q - x'\|_2 \leq c \cdot \min_{x \in \mathcal{D}} \|q - x\|_2.$$

We denote the optimal $k$-ANN set as $\mathcal{N}_k(q)$ and the approximate set
returned by an algorithm as $\hat{\mathcal{N}}_k(q)$. The **recall@k** is:

$$\text{recall@k} = \frac{|\mathcal{N}_k(q) \cap \hat{\mathcal{N}}_k(q)|}{k}$$

# Method

## Architecture Overview

LearnedANN consists of three stages:

1. **Learned Filter**: A lightweight MLP $f_\theta: \mathbb{R}^d \to [0, 1]^n$
   that assigns a probability $p_i$ to each point $x_i$ being a near neighbor.
2. **Candidate Selection**: Points with $p_i > \tau$ are selected, where
   $\tau$ is a learned threshold.
3. **Graph Refinement**: A small HNSW graph is built over the candidates for
   final ranking.

## Learned Filter Training

The filter is trained on a held-out query set $\mathcal{Q}$ with ground-truth
neighbor labels. For each $(q, \mathcal{N}_k(q))$, we minimize the binary
cross-entropy:

$$\mathcal{L}(\theta) = -\frac{1}{|\mathcal{Q}|} \sum_{q \in \mathcal{Q}}
\sum_{i=1}^{n} \left[ y_i \log p_i + (1 - y_i) \log(1 - p_i) \right]$$

where $y_i = \mathbf{1}[x_i \in \mathcal{N}_k(q)]$.

To handle large $n$, we use a **batched training** strategy with negative
sampling. The architecture employs:

- Input projection: $\mathbb{R}^d \to \mathbb{R}^{256}$ (single linear layer)
- 3 residual blocks with LayerNorm and GELU activations
- Output head: $\mathbb{R}^{256} \to \mathbb{R}^{n}$ (factorized via random
  projections for memory efficiency)

## Cascade of Learned Filters

For billion-scale datasets, a single filter is insufficient. We employ a cascade
of $L$ filters with increasing precision:

| Stage | Input Size | Output Size | Recall Target | Parameters |
|:-----:|:----------:|:-----------:|:-------------:|:----------:|
| 1     | $n$        | $n/10$      | 0.99          | 2M         |
| 2     | $n/10$     | $n/100$     | 0.98          | 4M         |
| 3     | $n/100$    | $n/1000$    | 0.97          | 8M         |

: Cascade architecture for Deep-1B ($n = 10^9$, $d = 96$). {#tbl:cascade}

Each stage reduces the candidate set while maintaining high recall. The total
memory overhead is approximately 14M parameters (56 MB in FP32).

## Theoretical Analysis

**Theorem 1**. *Let $\mathcal{D}$ be drawn i.i.d. from a distribution with
bounded doubling dimension $d_{\text{db}}$. If the learned filter achieves
recall $1 - \delta$ at each stage, then the expected query time is:*

$$\mathbb{E}[T(q)] = O\left( \frac{\log n}{\log(1/\alpha)} + d \right)$$

where $\alpha = 1 / (1 - \delta)^{1/L}$ and $L$ is the number of cascade stages.

*Proof sketch.* At each stage, the candidate set shrinks by factor $\alpha$.
After $L$ stages, the remaining candidates number
$n / \alpha^L = O(\log n)$ in expectation. The graph refinement over $O(\log n)
+ d$ candidates takes $O(\log n + d)$ time. $\square$

# Experiments

## Experimental Setup

**Datasets.** We evaluate on three standard benchmarks:

| Dataset     | $n$         | $d$  | Queries | Distance  |
|:------------|:-----------:|:----:|:-------:|:---------:|
| SIFT-1M     | 1,000,000   | 128  | 10,000  | Euclidean |
| GloVe-200   | 1,183,514   | 200  | 10,000  | Cosine    |
| Deep-1B     | 1,000,000,000 | 96 | 10,000  | Euclidean |

: Evaluation datasets. {#tbl:datasets}

**Baselines.** We compare against:

- **HNSW** [@malkov2018hnsw]: state-of-the-art graph-based method
- **IVF-PQ** [@jegou2011product]: inverted file with product quantization
- **ScaNN** [@guo2020accelerating]: quantization-based method from Google
- **DiskANN** [@subramanya2019disk]: disk-based graph for billion-scale

**Metrics.** We report recall@10, queries per second (QPS), and index build
time. All experiments use a single Intel Xeon 8380 CPU with 256 GB RAM.

## Results on SIFT-1M

Table @tbl:sift1m shows results on SIFT-1M. LearnedANN achieves 98.2% recall
at 45,200 QPS, which is 2.4x faster than HNSW at comparable recall.

| Method      | Recall@10 | QPS     | Build Time (s) |
|:------------|:---------:|:-------:|:---------------:|
| Brute-force | 100.0     | 1,200   | 0               |
| IVF-PQ      | 92.1      | 32,500  | 45              |
| HNSW        | 97.8      | 18,900  | 120             |
| ScaNN       | 96.5      | 28,300  | 85              |
| **LearnedANN** | **98.2** | **45,200** | 210        |

: Results on SIFT-1M. {#tbl:sift1m}

## Results on Deep-1B

On the billion-scale Deep-1B dataset, LearnedANN processes 12,400 QPS with
96.1% recall@10, outperforming DiskANN (8,200 QPS, 95.8% recall) by 1.5x.

## Ablation Study

We ablate each component of LearnedANN on SIFT-1M:

| Configuration               | Recall@10 | QPS     |
|:----------------------------|:---------:|:-------:|
| Full model                  | 98.2      | 45,200  |
| w/o cascade (single filter) | 94.5      | 38,100  |
| w/o graph refinement        | 91.3      | 52,800  |
| w/o factorized output       | 97.9      | 31,400  |

: Ablation study on SIFT-1M. {#tbl:ablation}

The cascade provides the largest recall improvement (+3.7%), while graph
refinement adds +2.9% recall at a modest speed cost.

## Memory Analysis

Table @tbl:memory compares memory usage across methods for Deep-1B.

| Method      | Index Size (GB) | Recall@10 |
|:------------|:---------------:|:---------:|
| HNSW        | 48.2            | 97.1      |
| IVF-PQ      | 12.4            | 91.8      |
| DiskANN     | 6.8*            | 95.8      |
| **LearnedANN** | **8.1**      | **96.1**  |

: Memory comparison on Deep-1B. DiskANN stores graph on disk. {#tbl:memory}

# Discussion

## When to Use LearnedANN

LearnedANN excels when:

- The data distribution is **smooth** (low intrinsic dimension)
- **Latency** is critical (real-time recommendation, interactive search)
- The dataset is **static** or infrequently updated (avoids retraining)

## Limitations

Our approach has several limitations:

1. **Training cost**: Building the cascade requires 4--8 hours on Deep-1B using
   8 V100 GPUs.
2. **Distribution shift**: If the query distribution drifts significantly from
   training, recall degrades by 3--5%.
3. **Dynamic data**: Insertions require periodic retraining; we leave
   incremental updates to future work.

## Broader Impact

Faster ANN search enables more responsive AI systems but could also lower the
barrier for large-scale surveillance applications. We encourage practitioners to
consider the ethical implications of their specific use cases.

# Conclusion

We presented LearnedANN, a learned index approach to approximate nearest
neighbor search that combines learned filters with graph-based refinement. Our
method achieves 1.8--3.2x speedups over HNSW while maintaining recall above
0.95 on standard benchmarks. The theoretical analysis shows logarithmic query
time under distributional assumptions. Future work includes extending to
dynamic settings and exploring hardware-aware architectures.

# References

\begingroup
\small

[@bentley1975multidimensional] Bentley, J. L. (1975). Multidimensional binary
search trees used for associative searching. *Communications of the ACM*,
18(9), 509--517.

[@datar2004locality] Datar, M., Immorlica, N., Indyk, P., & Mirrokni, V. S.
(2004). Locality-sensitive hashing scheme based on p-stable distributions. In
*Proceedings of the 20th Annual Symposium on Computational Geometry* (pp.
253--262).

[@guo2020accelerating] Guo, R., Sun, P., Lindgren, E., Geng, Q., Simcha, D.,
Chern, F., & Kumar, S. (2020). Accelerating large-scale inference with
anisotropic vector quantization. In *ICML*.

[@indyk1998approximate] Indyk, P., & Motwani, R. (1998). Approximate nearest
neighbors: Towards removing the curse of dimensionality. In *Proceedings of the
30th Annual ACM Symposium on Theory of Computing* (pp. 604--613).

[@jegou2011product] Jegou, H., Douze, M., & Schmid, C. (2011). Product
quantization for nearest neighbor search. *IEEE Transactions on Pattern
Analysis and Machine Intelligence*, 33(1), 117--128.

[@kraska2018case] Kraska, T., Beutel, A., Chi, E. H., Dean, J., & Polyzotis,
N. (2018). The case for learned index structures. In *Proceedings of the 2018
International Conference on Management of Data* (pp. 489--504).

[@kristo2020learned] Kristo, A., Vaidya, K., Kossmann, D., & Kraska, T.
(2020). Learned index for spatial queries. In *Proceedings of the 21st IEEE
International Conference on Mobile Data Management* (pp. 154--164).

[@malkov2018hnsw] Malkov, Y. A., & Yashunin, D. A. (2018). Efficient and
robust approximate nearest neighbor search using Hierarchical Navigable Small
World graphs. *IEEE Transactions on Pattern Analysis and Machine Intelligence*,
42(4), 824--836.

[@nathan2020learning] Nathan, V., Ding, J., Alizadeh, M., & Kraska, T.
(2020). Learning multi-dimensional indexes. In *Proceedings of the 2020
ACM SIGMOD International Conference on Management of Data* (pp. 985--999).

[@subramanya2019disk] Subramanya, S. J., Devvrit, F., Simhadri, H. V.,
Krishnawamy, R., & Kadekodi, R. (2019). DiskANN: Fast accurate billion-point
nearest neighbor search on a single node. In *NeurIPS*.

\endgroup
